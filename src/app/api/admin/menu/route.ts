import { NextRequest, NextResponse } from 'next/server';
import {
  readMenuFromStore,
  addOrUpdateMenuItem,
  deleteMenuItem,
  toggleDishAvailability,
} from '@/lib/menuStore';
import { DbMenuItem } from '@/types/restaurant';
import { requireAdmin } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    // Items are already normalised (snake_case + camelCase) by the store.
    const data = await readMenuFromStore(true);
    return NextResponse.json(
      { categories: data.categories, items: data.items },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Menu', 'Failed to fetch menu');
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      id,
      category_id,
      category,
      name,
      description,
      price,
      chicken_price,
      chickenPrice,
      is_veg,
      isVeg,
      is_spicy,
      isSpicy,
      is_bestseller,
      isBestSeller,
      is_special,
      isSpecial,
      image_url,
      image,
      tags,
      is_available,
      isAvailable,
      sort_order,
    } = body;

    const resolvedCategory = (category_id || category || '').trim();
    if (!name || !resolvedCategory || price === undefined) {
      return NextResponse.json(
        { error: 'Dish name, category, and price are required.' },
        { status: 400 }
      );
    }

    const resolvedVeg = is_veg !== undefined ? Boolean(is_veg) : Boolean(isVeg ?? true);
    const resolvedSpicy = is_spicy !== undefined ? Boolean(is_spicy) : Boolean(isSpicy ?? false);
    const resolvedBestseller = is_bestseller !== undefined ? Boolean(is_bestseller) : Boolean(isBestSeller ?? false);
    const resolvedSpecial = is_special !== undefined ? Boolean(is_special) : Boolean(isSpecial ?? false);
    const resolvedChickenPrice = chicken_price !== undefined && chicken_price !== null && chicken_price !== ''
      ? Number(chicken_price)
      : chickenPrice !== undefined && chickenPrice !== null && chickenPrice !== ''
      ? Number(chickenPrice)
      : null;
    const resolvedImage = (image_url || image || '').trim() || null;
    const resolvedAvailable = is_available !== undefined ? Boolean(is_available) : Boolean(isAvailable ?? true);

    const dishItem: DbMenuItem = {
      id: id || `dish-${Date.now().toString(36)}`,
      category_id: resolvedCategory,
      category: resolvedCategory,
      name: name.trim(),
      description: (description || '').trim(),
      price: Number(price),
      chicken_price: resolvedChickenPrice,
      chickenPrice: resolvedChickenPrice,
      is_veg: resolvedVeg,
      isVeg: resolvedVeg,
      is_spicy: resolvedSpicy,
      isSpicy: resolvedSpicy,
      is_bestseller: resolvedBestseller,
      isBestSeller: resolvedBestseller,
      is_special: resolvedSpecial,
      isSpecial: resolvedSpecial,
      image_url: resolvedImage,
      image: resolvedImage,
      tags: Array.isArray(tags) ? tags : [],
      is_available: resolvedAvailable,
      isAvailable: resolvedAvailable,
      sort_order: Number(sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    const saved = await addOrUpdateMenuItem(dishItem);
    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Menu', 'Failed to save dish.');
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, is_available, isAvailable } = body;

    const resolvedAvailable = is_available !== undefined ? is_available : isAvailable;

    if (!id || resolvedAvailable === undefined) {
      return NextResponse.json(
        { error: 'id and is_available are required.' },
        { status: 400 }
      );
    }

    const updated = await toggleDishAvailability(id, Boolean(resolvedAvailable));
    if (!updated) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Menu', 'Failed to update item.');
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Dish ID is required.' }, { status: 400 });
    }

    const deleted = await deleteMenuItem(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Menu', 'Failed to delete item.');
  }
}
