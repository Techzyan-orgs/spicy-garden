#!/usr/bin/env node
/**
 * One-time migration: converts /menu from the legacy array format
 *   menu/categories: [ {...}, ... ]     menu/items: [ {...}, ... ]
 * to records keyed by id with a single snake_case field convention
 *   menu/categories/{id}                menu/items/{id}
 *
 * Usage:
 *   node scripts/migrate-menu-to-keyed.mjs           # dry run: prints what would change
 *   node scripts/migrate-menu-to-keyed.mjs --apply   # backs up to ./.backups, then writes
 *
 * The write is a single atomic set() of /menu. Safe to re-run: an already
 * migrated menu is detected and left untouched.
 */
import { connect, backup, APPLY } from './lib/firebase.mjs';

const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}$/;

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const bool = (a, b, d) => (typeof a === 'boolean' ? a : typeof b === 'boolean' ? b : d);

function isKeyedById(c) {
  return c && typeof c === 'object' && !Array.isArray(c) && Object.entries(c).every(([k, v]) => v && v.id === k);
}

const db = connect();
const menu = (await db.ref('menu').once('value')).val();

if (!menu) {
  console.log('No /menu node found — nothing to migrate.');
  process.exit(0);
}
if (isKeyedById(menu.categories ?? {}) && isKeyedById(menu.items ?? {})) {
  console.log('Menu is already in the keyed format — nothing to do.');
  process.exit(0);
}

const problems = [];
const categories = {};
Object.values(menu.categories ?? {}).forEach((c, idx) => {
  if (!c || !str(c.id) || !str(c.label)) return problems.push(`category #${idx}: missing id/label`);
  if (!SAFE_KEY.test(c.id)) return problems.push(`category "${c.id}": unsafe id`);
  if (categories[c.id]) return problems.push(`category "${c.id}": duplicate id`);
  categories[c.id] = {
    id: c.id,
    label: str(c.label),
    icon: str(c.icon),
    subtitle: str(c.subtitle),
    description: str(c.description),
    image_url: str(c.image_url) ?? str(c.image),
    sort_order: num(c.sort_order) ?? idx + 1,
    is_active: c.is_active !== false,
  };
});

const items = {};
Object.values(menu.items ?? {}).forEach((i, idx) => {
  if (!i || !str(i.id) || !str(i.name)) return problems.push(`item #${idx}: missing id/name`);
  if (!SAFE_KEY.test(i.id)) return problems.push(`item "${i.id}": unsafe id`);
  if (items[i.id]) return problems.push(`item "${i.id}": duplicate id`);
  const categoryId = str(i.category_id) ?? str(i.category);
  const price = num(i.price);
  if (!categoryId || price === null) return problems.push(`item "${i.id}": missing category or price`);
  if (!categories[categoryId]) problems.push(`item "${i.id}": category "${categoryId}" does not exist (kept as-is)`);
  items[i.id] = {
    id: i.id,
    category_id: categoryId,
    name: str(i.name),
    description: typeof i.description === 'string' ? i.description : '',
    price,
    chicken_price: num(i.chicken_price) ?? num(i.chickenPrice),
    is_veg: bool(i.is_veg, i.isVeg, true),
    is_spicy: bool(i.is_spicy, i.isSpicy, false),
    is_bestseller: bool(i.is_bestseller, i.isBestSeller, false),
    is_special: bool(i.is_special, i.isSpecial, false),
    image_url: str(i.image_url) ?? str(i.image),
    tags: Array.isArray(i.tags) ? i.tags.filter((t) => typeof t === 'string') : [],
    is_available: i.is_available !== false && i.isAvailable !== false,
    sort_order: num(i.sort_order) ?? idx + 1,
    ...(str(i.created_at) ? { created_at: str(i.created_at) } : {}),
    ...(str(i.updated_at) ? { updated_at: str(i.updated_at) } : {}),
  };
});

const srcCats = Object.keys(menu.categories ?? {}).length;
const srcItems = Object.keys(menu.items ?? {}).length;
console.log(`Categories: ${srcCats} → ${Object.keys(categories).length}`);
console.log(`Items:      ${srcItems} → ${Object.keys(items).length}`);
if (problems.length) {
  console.log(`\n${problems.length} issue(s):`);
  problems.forEach((p) => console.log(`  - ${p}`));
}

const dropped = srcCats - Object.keys(categories).length + (srcItems - Object.keys(items).length);
if (dropped > 0) {
  console.error(`\nRefusing to migrate: ${dropped} record(s) would be dropped. Fix them first.`);
  process.exit(1);
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to write the changes.');
  process.exit(0);
}

const backupFile = backup('menu', menu);
console.log(`\nBackup written to ${backupFile}`);
await db.ref('menu').set({ categories, items });
console.log('Migration complete.');
process.exit(0);
