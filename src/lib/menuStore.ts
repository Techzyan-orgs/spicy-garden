import fs from 'fs';
import path from 'path';
import { DbCategory, DbMenuItem } from '@/types/restaurant';
import { RESTAURANT_DATA } from '@/data/restaurantData';
import { getFirebaseData, setFirebaseData, isFirebaseConfigured } from './firebaseRtdb';

export interface MenuStoreData {
  categories: DbCategory[];
  items: DbMenuItem[];
}

const MENU_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'menu.json');

// In-memory cache for fast lookups
let cachedMenuData: MenuStoreData | null = null;
let lastReadTime = 0;

function getInitialMenuData(): MenuStoreData {
  const cats: DbCategory[] = RESTAURANT_DATA.menu.categories.map((c, idx) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    subtitle: c.subtitle || null,
    description: c.description || null,
    image_url: c.image || null,
    sort_order: idx + 1,
    is_active: true,
  }));

  const items: DbMenuItem[] = RESTAURANT_DATA.menu.items.map((i, idx) => ({
    id: i.id,
    category: i.category,
    category_id: i.category,
    name: i.name,
    description: i.description,
    price: i.price,
    chickenPrice: i.chickenPrice || null,
    chicken_price: i.chickenPrice || null,
    isVeg: i.isVeg,
    is_veg: i.isVeg,
    isSpicy: i.isSpicy || false,
    is_spicy: i.isSpicy || false,
    isBestSeller: i.isBestSeller || false,
    is_bestseller: i.isBestSeller || false,
    isSpecial: i.isSpecial || false,
    is_special: i.isSpecial || false,
    image: i.image || null,
    image_url: i.image || null,
    tags: i.tags || [],
    isAvailable: true,
    is_available: true,
    sort_order: idx + 1,
  }));

  return { categories: cats, items };
}

function readLocalFallback(): MenuStoreData {
  try {
    if (fs.existsSync(MENU_FILE_PATH)) {
      const content = fs.readFileSync(MENU_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && (Array.isArray(parsed.categories) || typeof parsed.categories === 'object')) {
        const categories = Array.isArray(parsed.categories)
          ? parsed.categories
          : Object.values(parsed.categories);
        const items = Array.isArray(parsed.items)
          ? parsed.items
          : Object.values(parsed.items || {});
        return { categories, items };
      }
    }
  } catch (err) {
    console.warn('[MenuStore] Error reading local fallback:', err);
  }
  return getInitialMenuData();
}

/**
 * Normalizes Firebase data in case Realtime Database returns arrays or objects
 */
function normalizeMenuData(raw: any): MenuStoreData | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawCats = raw.categories;
  const rawItems = raw.items;

  if (!rawCats && !rawItems) return null;

  const categories: DbCategory[] = Array.isArray(rawCats)
    ? rawCats
    : rawCats
    ? Object.values(rawCats)
    : [];

  const items: DbMenuItem[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
    ? Object.values(rawItems)
    : [];

  return { categories, items };
}

/**
 * Reads the menu catalog.
 * Priority: Memory Cache -> Firebase Realtime Database (/menu) -> Local file -> Initial defaults.
 */
export async function readMenuFromStore(forceFresh = false): Promise<MenuStoreData> {
  const now = Date.now();
  if (!forceFresh && cachedMenuData && now - lastReadTime < 5000) {
    return cachedMenuData;
  }

  // 1. Fetch from Firebase Realtime Database if configured
  if (isFirebaseConfigured()) {
    try {
      const remote = await getFirebaseData<any>('menu');
      const normalized = normalizeMenuData(remote);
      if (normalized && normalized.categories.length > 0) {
        cachedMenuData = normalized;
        lastReadTime = now;
        return normalized;
      }
    } catch (fbErr) {
      console.warn('[MenuStore] Firebase fetch warning, falling back:', fbErr);
    }
  }

  // 2. Fallback to local file or defaults
  const fallback = readLocalFallback();
  cachedMenuData = fallback;
  lastReadTime = now;
  return fallback;
}

/**
 * Writes the updated menu to Firebase Realtime Database (/menu) and local memory cache.
 */
export async function writeMenuToStore(data: MenuStoreData): Promise<void> {
  cachedMenuData = data;
  lastReadTime = Date.now();

  // 1. Write to Firebase Realtime Database
  if (isFirebaseConfigured()) {
    const success = await setFirebaseData('menu', data);
    if (!success) {
      console.warn('[MenuStore] Failed to write menu to Firebase Realtime Database');
    }
  }

  // 2. Best-effort local file update (dev environment only; skipped on serverless production)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dir = path.dirname(MENU_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(MENU_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (fsErr) {
      // Expected on read-only environments
    }
  }
}

export async function addOrUpdateMenuItem(item: DbMenuItem): Promise<DbMenuItem> {
  const current = await readMenuFromStore(true);
  const existingIndex = current.items.findIndex((i) => i.id === item.id);

  let updatedItems: DbMenuItem[];
  if (existingIndex >= 0) {
    updatedItems = [...current.items];
    updatedItems[existingIndex] = {
      ...updatedItems[existingIndex],
      ...item,
      updated_at: new Date().toISOString(),
    };
  } else {
    updatedItems = [...current.items, { ...item, created_at: new Date().toISOString() }];
  }

  await writeMenuToStore({ ...current, items: updatedItems });
  return item;
}

export async function deleteMenuItem(itemId: string): Promise<boolean> {
  const current = await readMenuFromStore(true);
  const filtered = current.items.filter((i) => i.id !== itemId);
  if (filtered.length === current.items.length) return false;

  await writeMenuToStore({ ...current, items: filtered });
  return true;
}

export async function toggleDishAvailability(itemId: string, isAvailable: boolean): Promise<DbMenuItem | null> {
  const current = await readMenuFromStore(true);
  const item = current.items.find((i) => i.id === itemId);
  if (!item) return null;

  item.is_available = isAvailable;
  (item as any).isAvailable = isAvailable;
  item.updated_at = new Date().toISOString();

  await writeMenuToStore(current);
  return item;
}

export async function addOrUpdateCategory(cat: DbCategory): Promise<DbCategory> {
  const current = await readMenuFromStore(true);
  const existingIdx = current.categories.findIndex((c) => c.id === cat.id);

  let updatedCategories: DbCategory[];
  if (existingIdx >= 0) {
    updatedCategories = [...current.categories];
    updatedCategories[existingIdx] = { ...updatedCategories[existingIdx], ...cat };
  } else {
    updatedCategories = [...current.categories, cat];
  }

  await writeMenuToStore({ ...current, categories: updatedCategories });
  return cat;
}

export async function deleteCategory(catId: string): Promise<boolean> {
  const current = await readMenuFromStore(true);
  const filtered = current.categories.filter((c) => c.id !== catId);
  if (filtered.length === current.categories.length) return false;

  // Reassign any items in the deleted category to the first remaining category or default
  const fallbackCatId = filtered[0]?.id || 'starters';
  const updatedItems = current.items.map((item) =>
    item.category_id === catId ? { ...item, category_id: fallbackCatId } : item
  );

  await writeMenuToStore({ ...current, categories: filtered, items: updatedItems });
  return true;
}
