import { NextRequest, NextResponse } from 'next/server';
import { readMenuFromStore, addOrUpdateCategory, deleteCategory } from '@/lib/menuStore';
import { DbCategory } from '@/types/restaurant';
import { isAdminRequest } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const checkAdminAuth = isAdminRequest;

export async function GET(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const data = await readMenuFromStore();
    return NextResponse.json({ categories: data.categories });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

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
    return NextResponse.json({ error: err?.message || 'Failed to save category' }, { status: 500 });
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
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const deleted = await deleteCategory(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete category' }, { status: 500 });
  }
}
