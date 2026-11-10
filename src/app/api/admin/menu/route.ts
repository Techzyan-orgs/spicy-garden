import { NextRequest, NextResponse } from 'next/server';
import {
  readMenuFromStore,
  addOrUpdateMenuItem,
  deleteMenuItem,
  toggleDishAvailability,
} from '@/lib/menuStore';
import { DbMenuItem } from '@/types/restaurant';
import { isAdminRequest } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const checkAdminAuth = isAdminRequest;

export async function GET(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const data = await readMenuFromStore();
    const normalizedItems = data.items.map((i: any) => ({
      ...i,
      category_id: i.category_id || i.category,
      category: i.category || i.category_id,
      is_veg: i.is_veg ?? i.isVeg ?? true,
      isVeg: i.isVeg ?? i.is_veg ?? true,
      is_spicy: i.is_spicy ?? i.isSpicy ?? false,
      isSpicy: i.isSpicy ?? i.is_spicy ?? false,
      is_bestseller: i.is_bestseller ?? i.isBestSeller ?? false,
      isBestSeller: i.isBestSeller ?? i.is_bestseller ?? false,
      is_special: i.is_special ?? i.isSpecial ?? false,
      isSpecial: i.isSpecial ?? i.is_special ?? false,
      image_url: i.image_url || i.image || null,
      image: i.image || i.image_url || null,
      chicken_price: i.chicken_price ?? i.chickenPrice ?? null,
      chickenPrice: i.chickenPrice ?? i.chicken_price ?? null,
      is_available: i.is_available ?? i.isAvailable ?? true,
      isAvailable: i.isAvailable ?? i.is_available ?? true,
    }));

    return NextResponse.json({
      categories: data.categories,
      items: normalizedItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

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
    console.error('[API Admin Menu POST] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to save dish.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

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
    return NextResponse.json({ error: err?.message || 'Failed to update item.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

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
    return NextResponse.json({ error: err?.message || 'Failed to delete item.' }, { status: 500 });
  }
}
