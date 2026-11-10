/**
 * Menu catalog store. Firebase Realtime Database is the single source of truth.
 *
 * Storage layout (keyed by id, so each edit touches only one record):
 *   menu/categories/{categoryId} → StoredCategory
 *   menu/items/{itemId}          → StoredMenuItem
 *
 * There is NO local-file or hardcoded fallback. When the database cannot be
 * read, functions throw DataUnavailableError and callers respond with 503.
 * An empty database is a valid (empty) menu.
 *
 * Older deployments stored the menu as two arrays. Reads still understand
 * that shape, but writes are refused until `node scripts/migrate-menu-to-keyed.mjs --apply`
 * has been run, so array indexes and ids can never get mixed.
 */
import { DbCategory, DbMenuItem } from '@/types/restaurant';
import { dbGet, dbSet, dbUpdate, dbRemove, assertSafeKey } from './firebaseAdmin';

export interface MenuStoreData {
  categories: DbCategory[];
  items: DbMenuItem[];
}

/** Canonical (snake_case) shape persisted in Firebase. */
interface StoredCategory {
  id: string;
  label: string;
  icon: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface StoredMenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  chicken_price: number | null;
  is_veg: boolean;
  is_spicy: boolean;
  is_bestseller: boolean;
  is_special: boolean;
  image_url: string | null;
  tags: string[];
  is_available: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export class MenuMigrationRequiredError extends Error {
  constructor() {
    super(
      'The menu is still stored in the legacy array format. Run `node scripts/migrate-menu-to-keyed.mjs --apply` before editing.'
    );
    this.name = 'MenuMigrationRequiredError';
  }
}

export class MenuValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuValidationError';
  }
}

export class CategoryInUseError extends Error {
  constructor(public readonly itemCount: number) {
    super(
      `This category still contains ${itemCount} dish${itemCount === 1 ? '' : 'es'}. Move or delete them first.`
    );
    this.name = 'CategoryInUseError';
  }
}

export class MenuNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = 'MenuNotFoundError';
  }
}

// ── Normalisation ───────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(primary: unknown, alt: unknown, fallback: boolean): boolean {
  if (typeof primary === 'boolean') return primary;
  if (typeof alt === 'boolean') return alt;
  return fallback;
}

function normalizeStoredCategory(raw: any, index: number): StoredCategory | null {
  if (!raw || typeof raw !== 'object' || !str(raw.id) || !str(raw.label)) return null;
  return {
    id: String(raw.id),
    label: String(raw.label),
    icon: str(raw.icon),
    subtitle: str(raw.subtitle),
    description: str(raw.description),
    image_url: str(raw.image_url) ?? str(raw.image),
    sort_order: num(raw.sort_order) ?? index + 1,
    is_active: raw.is_active !== false,
  };
}

function normalizeStoredItem(raw: any, index: number): StoredMenuItem | null {
  if (!raw || typeof raw !== 'object' || !str(raw.id) || !str(raw.name)) return null;
  const categoryId = str(raw.category_id) ?? str(raw.category);
  const price = num(raw.price);
  if (!categoryId || price === null) return null;
  return {
    id: String(raw.id),
    category_id: categoryId,
    name: String(raw.name),
    description: typeof raw.description === 'string' ? raw.description : '',
    price,
    chicken_price: num(raw.chicken_price) ?? num(raw.chickenPrice),
    is_veg: bool(raw.is_veg, raw.isVeg, true),
    is_spicy: bool(raw.is_spicy, raw.isSpicy, false),
    is_bestseller: bool(raw.is_bestseller, raw.isBestSeller, false),
    is_special: bool(raw.is_special, raw.isSpecial, false),
    image_url: str(raw.image_url) ?? str(raw.image),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') : [],
    is_available: raw.is_available !== false && raw.isAvailable !== false,
    sort_order: num(raw.sort_order) ?? index + 1,
    created_at: str(raw.created_at) ?? undefined,
    updated_at: str(raw.updated_at) ?? undefined,
  };
}

/** API shape: both snake_case and camelCase, as existing clients expect. */
function toApiCategory(c: StoredCategory): DbCategory {
  return {
    id: c.id,
    label: c.label,
    icon: c.icon,
    subtitle: c.subtitle,
    description: c.description,
    image: c.image_url,
    image_url: c.image_url,
    sort_order: c.sort_order,
    is_active: c.is_active,
  };
}

function toApiItem(i: StoredMenuItem): DbMenuItem {
  return {
    id: i.id,
    category_id: i.category_id,
    category: i.category_id,
    name: i.name,
    description: i.description,
    price: i.price,
    chicken_price: i.chicken_price,
    chickenPrice: i.chicken_price,
    is_veg: i.is_veg,
    isVeg: i.is_veg,
    is_spicy: i.is_spicy,
    isSpicy: i.is_spicy,
    is_bestseller: i.is_bestseller,
    isBestSeller: i.is_bestseller,
    is_special: i.is_special,
    isSpecial: i.is_special,
    image: i.image_url,
    image_url: i.image_url,
    tags: i.tags,
    is_available: i.is_available,
    isAvailable: i.is_available,
    sort_order: i.sort_order,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

/** True when a collection is stored keyed by id (the current format). */
function isKeyedById(collection: unknown): boolean {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return false;
  return Object.entries(collection as Record<string, any>).every(([k, v]) => v && v.id === k);
}

function normalizeCollection<T>(raw: unknown, fn: (r: any, i: number) => T | null): T[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw as Record<string, unknown>)
    .map((r, i) => fn(r, i))
    .filter((x): x is T => x !== null);
}

// ── Reads ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5000;
let cache: { data: MenuStoreData; at: number } | null = null;

function invalidateCache() {
  cache = null;
}

/**
 * Reads the full menu from Firebase. Throws DataUnavailableError on failure.
 * `forceFresh` bypasses the short per-instance cache (use it for pricing orders).
 */
export async function readMenuFromStore(forceFresh = false): Promise<MenuStoreData> {
  if (!forceFresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const raw = await dbGet<{ categories?: unknown; items?: unknown }>('menu');
  const categories = normalizeCollection(raw?.categories, normalizeStoredCategory)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toApiCategory);
  const items = normalizeCollection(raw?.items, normalizeStoredItem)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toApiItem);

  const data = { categories, items };
  cache = { data, at: Date.now() };
  return data;
}

async function assertKeyedFormat(): Promise<{ categories: Record<string, any>; items: Record<string, any> }> {
  const raw = await dbGet<{ categories?: unknown; items?: unknown }>('menu');
  const categories = raw?.categories ?? {};
  const items = raw?.items ?? {};
  const cEmpty = typeof categories === 'object' && Object.keys(categories as object).length === 0;
  const iEmpty = typeof items === 'object' && Object.keys(items as object).length === 0;
  if ((!cEmpty && !isKeyedById(categories)) || (!iEmpty && !isKeyedById(items))) {
    throw new MenuMigrationRequiredError();
  }
  return { categories: categories as Record<string, any>, items: items as Record<string, any> };
}

// ── Item writes ─────────────────────────────────────────────────────────────

/**
 * Image URLs must be our own static assets ("/..."), our Cloudinary account, or
 * an inline raster image (legacy upload fallback). Anything else is rejected so
 * the menu cannot be used to hot-link or track visitors via third-party hosts.
 */
function validateImageUrl(url: string | null, label: string) {
  if (url === null) return;
  if (url.length > 2_000_000) throw new MenuValidationError(`${label} image is too large.`);
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('..')) return;
  if (/^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(url)) return;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (cloud && url.startsWith(`https://res.cloudinary.com/${cloud}/`)) return;
  throw new MenuValidationError(`${label} image must be uploaded through the admin panel.`);
}

function validateItem(item: StoredMenuItem) {
  validateImageUrl(item.image_url, 'Dish');
  if (item.tags.length > 10 || item.tags.some((t) => t.length > 40)) {
    throw new MenuValidationError('At most 10 tags of up to 40 characters each.');
  }
  if (!item.name || item.name.length > 120) throw new MenuValidationError('Dish name must be 1–120 characters.');
  if (!Number.isFinite(item.price) || item.price < 0 || item.price > 100000) {
    throw new MenuValidationError('Price must be a number between 0 and 100000.');
  }
  if (item.chicken_price !== null && (!Number.isFinite(item.chicken_price) || item.chicken_price < 0 || item.chicken_price > 100000)) {
    throw new MenuValidationError('Non-veg price must be a number between 0 and 100000.');
  }
  if (item.description.length > 1000) throw new MenuValidationError('Description must be at most 1000 characters.');
}

export async function addOrUpdateMenuItem(input: DbMenuItem): Promise<DbMenuItem> {
  const id = assertSafeKey(input.id, 'dish id');
  const { categories, items } = await assertKeyedFormat();

  const stored = normalizeStoredItem(input, 0);
  if (!stored) throw new MenuValidationError('Dish name, category and a numeric price are required.');
  assertSafeKey(stored.category_id, 'category id');
  if (!categories[stored.category_id]) throw new MenuValidationError(`Category "${stored.category_id}" does not exist.`);
  validateItem(stored);

  const now = new Date().toISOString();
  const existing = items[id];
  const record: StoredMenuItem = {
    ...stored,
    id,
    created_at: (existing && typeof existing.created_at === 'string' && existing.created_at) || now,
    updated_at: now,
  };

  await dbSet(`menu/items/${id}`, record);
  invalidateCache();
  return toApiItem(record);
}

export async function deleteMenuItem(itemId: string): Promise<boolean> {
  const id = assertSafeKey(itemId, 'dish id');
  const { items } = await assertKeyedFormat();
  if (!items[id]) return false;
  await dbRemove(`menu/items/${id}`);
  invalidateCache();
  return true;
}

export async function toggleDishAvailability(itemId: string, isAvailable: boolean): Promise<DbMenuItem | null> {
  const id = assertSafeKey(itemId, 'dish id');
  const { items } = await assertKeyedFormat();
  const existing = items[id];
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  await dbUpdate(`menu/items/${id}`, { is_available: isAvailable, updated_at: updatedAt });
  invalidateCache();

  const normalized = normalizeStoredItem({ ...existing, is_available: isAvailable, updated_at: updatedAt }, 0);
  return normalized ? toApiItem(normalized) : null;
}

// ── Category writes ─────────────────────────────────────────────────────────

export async function addOrUpdateCategory(input: DbCategory): Promise<DbCategory> {
  const id = assertSafeKey(input.id, 'category id');
  await assertKeyedFormat();

  const stored = normalizeStoredCategory(input, 0);
  if (!stored) throw new MenuValidationError('Category id and label are required.');
  if (stored.label.length > 80) throw new MenuValidationError('Category label must be at most 80 characters.');
  validateImageUrl(stored.image_url, 'Category');
  stored.sort_order = num(input.sort_order) ?? 0;

  await dbSet(`menu/categories/${id}`, { ...stored, id });
  invalidateCache();
  return toApiCategory({ ...stored, id });
}

/**
 * Deletes a category. If it still contains dishes, `reassignTo` must name an
 * existing category to move them to; otherwise CategoryInUseError is thrown.
 * The delete and the reassignment happen in one atomic multi-path update.
 */
export async function deleteCategory(catId: string, reassignTo?: string | null): Promise<boolean> {
  const id = assertSafeKey(catId, 'category id');
  const { categories, items } = await assertKeyedFormat();
  if (!categories[id]) return false;

  const affected = Object.values(items).filter((i: any) => (i?.category_id ?? i?.category) === id);

  const updates: Record<string, unknown> = { [`categories/${id}`]: null };
  if (affected.length > 0) {
    if (!reassignTo) throw new CategoryInUseError(affected.length);
    const target = assertSafeKey(reassignTo, 'target category id');
    if (target === id || !categories[target]) {
      throw new MenuValidationError('Target category for the dishes does not exist.');
    }
    const now = new Date().toISOString();
    for (const item of affected as any[]) {
      updates[`items/${item.id}/category_id`] = target;
      updates[`items/${item.id}/updated_at`] = now;
    }
  }

  await dbUpdate('menu', updates);
  invalidateCache();
  return true;
}
