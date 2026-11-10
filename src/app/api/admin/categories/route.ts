import { NextRequest, NextResponse } from 'next/server';
import { readMenuFromStore, addOrUpdateCategory, deleteCategory } from '@/lib/menuStore';
import { DbCategory } from '@/types/restaurant';
import { requireAdmin } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const data = await readMenuFromStore(true);
    return NextResponse.json({ categories: data.categories });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Categories', 'Failed to fetch categories');
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, label, icon, subtitle, description, image_url, sort_order, is_active } = body;

    if (!id || !label) {
      return NextResponse.json(
        { error: 'Category ID and Label are required.' },
        { status: 400 }
      );
    }

    const category: DbCategory = {
      id: id.trim().toLowerCase(),
      label: label.trim(),
      icon: icon || 'Utensils',
      subtitle: subtitle || null,
      description: description || null,
      image_url: image_url || null,
      sort_order: Number(sort_order) || 0,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    };

    const saved = await addOrUpdateCategory(category);
    return NextResponse.json({ success: true, category: saved });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Categories', 'Failed to save category');
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Optional: move this category's dishes to another category in the same atomic update.
    const deleted = await deleteCategory(id, searchParams.get('reassignTo'));
    if (!deleted) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return storeErrorResponse(err, 'API Admin Categories', 'Failed to delete category');
  }
}
