import { NextResponse } from 'next/server';
import { readMenuFromStore } from '@/lib/menuStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const menuData = await readMenuFromStore();

    const categories = menuData.categories.map((c: any) => ({
      id: c.id,
      label: c.label,
      icon: c.icon || 'Utensils',
      subtitle: c.subtitle || undefined,
      description: c.description || undefined,
      image: c.image || c.image_url || undefined,
      image_url: c.image_url || c.image || undefined,
      sort_order: c.sort_order || 0,
      is_active: c.is_active ?? true,
    }));

    const items = menuData.items.map((rawItem: any) => {
      const category = rawItem.category || rawItem.category_id || 'pizza';
      const isVeg = rawItem.isVeg ?? rawItem.is_veg ?? true;
      const isSpicy = Boolean(rawItem.isSpicy ?? rawItem.is_spicy);
      const isBestSeller = Boolean(rawItem.isBestSeller ?? rawItem.is_bestseller);
      const isSpecial = Boolean(rawItem.isSpecial ?? rawItem.is_special);
      const isAvailable = rawItem.is_available !== false && rawItem.isAvailable !== false;
      const chickenPrice = rawItem.chickenPrice ?? rawItem.chicken_price ?? undefined;
      const image = rawItem.image || rawItem.image_url || undefined;

      return {
        id: rawItem.id,
        name: rawItem.name,
        category,
        category_id: category,
        price: Number(rawItem.price),
        chickenPrice: chickenPrice ? Number(chickenPrice) : undefined,
        chicken_price: chickenPrice ? Number(chickenPrice) : undefined,
        isVeg,
        is_veg: isVeg,
        isSpicy,
        is_spicy: isSpicy,
        isBestSeller,
        is_bestseller: isBestSeller,
        isSpecial,
        is_special: isSpecial,
        description: rawItem.description || '',
        image,
        image_url: image,
        tags: rawItem.tags || [],
        isAvailable,
        is_available: isAvailable,
        sort_order: rawItem.sort_order || 0,
      };
    });

    return NextResponse.json(
      {
        source: 'local_store',
        categories,
        items,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('[API Menu] Error loading menu:', error);
    return NextResponse.json(
      { error: 'Failed to load menu data' },
      { status: 500 }
    );
  }
}
