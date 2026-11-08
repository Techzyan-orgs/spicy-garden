'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { DbMenuItem, DbCategory } from '@/types/restaurant';
import { compressImage, formatFileSize } from '@/lib/imageCompression';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Flame,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ImageIcon
} from 'lucide-react';

function isUploadedPhoto(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('/unnamed') ||
    trimmed === '/pasta.webp' ||
    trimmed === '/maggi.webp' ||
    trimmed === '/sandwich.webp'
  ) {
    return false;
  }
  return true;
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit / Create Dish Modal State
  const [editingItem, setEditingItem] = useState<Partial<DbMenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [chickenPrice, setChickenPrice] = useState<string>('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [isSpicy, setIsSpicy] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isSpecial, setIsSpecial] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [tagsInput, setTagsInput] = useState('');

  const fetchMenuData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu');
      if (res.ok) {
        const data = await res.json();
        if (data.categories) setCategories(data.categories);
        if (data.items) setItems(data.items);
      }
    } catch (err) {
      console.error('[Admin Menu] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  const openCreateModal = () => {
    setIsNewItem(true);
    setName('');
    setCategoryId(categories[0]?.id || 'pizza');
    setPrice(99);
    setChickenPrice('');
    setDescription('');
    setImageUrl('');
    setCompressionInfo(null);
    setIsVeg(true);
    setIsSpicy(false);
    setIsBestseller(false);
    setIsSpecial(false);
    setIsAvailable(true);
    setSortOrder(items.length + 1);
    setTagsInput('');
    setEditingItem({});
  };

  const openEditModal = (item: DbMenuItem) => {
    setIsNewItem(false);
    setName(item.name);
    setCategoryId(item.category_id || item.category || 'pizza');
    setPrice(Number(item.price));
    setChickenPrice(item.chicken_price ? String(item.chicken_price) : '');
    setDescription(item.description);
    setImageUrl(isUploadedPhoto(item.image_url) ? (item.image_url || '') : '');
    setCompressionInfo(null);
    setIsVeg(Boolean(item.is_veg));
    setIsSpicy(Boolean(item.is_spicy));
    setIsBestseller(Boolean(item.is_bestseller));
    setIsSpecial(Boolean(item.is_special));
    setIsAvailable(item.is_available ?? true);
    setSortOrder(item.sort_order);
    setTagsInput((item.tags || []).join(', '));
    setEditingItem(item);
  };

  // Image file upload handler with high-fidelity client-side compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setIsUploading(true);
    setCompressionInfo(null);

    try {
      // 1. High-fidelity compression (1200px max, 0.88 WebP, high smoothing)
      const compressed = await compressImage(rawFile, {
        maxDimension: 1200,
        quality: 0.88,
        format: 'image/webp',
      });

      const origSize = formatFileSize(compressed.originalSize);
      const newSize = formatFileSize(compressed.compressedSize);
      const savedInfo =
        compressed.reductionPercentage > 0
          ? `Optimized: ${origSize} ➔ ${newSize} (${compressed.reductionPercentage}% smaller)`
          : `Ready: ${newSize}`;

      setCompressionInfo(savedInfo);

      // 2. Stream optimized WebP to upload endpoint
      const formData = new FormData();
      formData.append('file', compressed.file);

      const res = await fetch('/api/admin/menu/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setImageUrl(data.publicUrl);
      setFeedback({
        type: 'success',
        message: `Image optimized & uploaded! (${origSize} ➔ ${newSize})`,
      });
    } catch (err: any) {
      console.error('[Admin Menu] Image upload error:', err);
      setFeedback({ type: 'error', message: err?.message || 'Failed to upload image.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      id: isNewItem ? undefined : editingItem?.id,
      category_id: categoryId,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      chicken_price: chickenPrice ? Number(chickenPrice) : null,
      is_veg: isVeg,
      is_spicy: isSpicy,
      is_bestseller: isBestseller,
      is_special: isSpecial,
      image_url: imageUrl.trim() || null,
      tags: tagsArray,
      is_available: isAvailable,
      sort_order: Number(sortOrder) || 0,
    };

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save menu item.');

      setFeedback({
        type: 'success',
        message: isNewItem ? `Dish "${name}" added to menu!` : `Dish "${name}" updated!`,
      });

      setEditingItem(null);
      notifyMenuUpdate();
      fetchMenuData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save menu item.' });
    } finally {
      setIsSaving(false);
    }
  };

  const notifyMenuUpdate = () => {
    try {
      localStorage.setItem('sg_menu_last_update', Date.now().toString());
      window.dispatchEvent(new CustomEvent('sg_menu_updated'));
    } catch (e) {}
  };

  const toggleAvailability = async (item: DbMenuItem) => {
    const nextState = !item.is_available;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextState } : i))
    );
    notifyMenuUpdate();

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_available: nextState }),
      });
      if (!res.ok) throw new Error('Failed to update availability.');
    } catch (err) {
      console.error('[Admin Menu] Toggle error:', err);
      fetchMenuData();
    }
  };

  const handleDeleteItem = async (item: DbMenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" from the menu?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/menu?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item.');

      setFeedback({ type: 'success', message: `Deleted "${item.name}".` });
      notifyMenuUpdate();
      fetchMenuData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to delete dish.' });
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Menu Catalog Management
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create, edit prices, descriptions, photos, and live availability of all cafe dishes
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-md shadow-chili-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Dish</span>
        </button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto p-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-chili-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All Categories ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-chili-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat.label} ({items.filter((i) => i.category_id === cat.id).length})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 px-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dish name..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs focus:outline-none focus:ring-2 focus:ring-chili-500"
          />
        </div>
      </div>

      {/* Dishes Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-gray-400">Loading dishes...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            No dishes found in this category.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-chili-600 text-white"
          >
            Add Your First Dish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Dish Photo Banner / Add Photo Prompt */}
                {isUploadedPhoto(item.image_url) ? (
                  <div className="relative w-full h-36 rounded-2xl overflow-hidden mb-3 bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 group/img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url || ''}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/unnamed (2).webp';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                      <span className="text-[11px] font-semibold text-white/90">Dish Photo</span>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white/90 text-gray-900 hover:bg-white transition-colors cursor-pointer shadow-sm"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="w-full h-16 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 hover:border-chili-400 dark:hover:border-chili-600 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-chili-50/30 dark:hover:bg-chili-950/20 flex items-center justify-center space-x-2 text-gray-400 hover:text-chili-600 dark:text-gray-500 dark:hover:text-chili-400 mb-3 text-xs transition-all cursor-pointer group/btn"
                    title="Click to add photo for this dish"
                  >
                    <Upload className="w-3.5 h-3.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                    <span className="font-medium">+ Add Photo</span>
                  </button>
                )}

                {/* Top badges & Quick availability switch */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center p-0.5 ${
                        item.is_veg ? 'border-emerald-600' : 'border-rose-600'
                      }`}
                      title={item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </span>

                    {item.is_bestseller && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        Bestseller
                      </span>
                    )}

                    {item.is_special && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-chili-100 dark:bg-chili-950 text-chili-700 dark:text-chili-300">
                        Special
                      </span>
                    )}

                    {item.is_spicy && (
                      <span className="flex items-center space-x-0.5 text-[11px] font-medium text-chili-600">
                        <Flame className="w-3 h-3 fill-chili-500" />
                      </span>
                    )}
                  </div>

                  {/* Availability Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => toggleAvailability(item)}
                    className="flex items-center space-x-1 text-xs cursor-pointer"
                    title={item.is_available ? 'Click to mark Sold Out' : 'Click to mark Available'}
                  >
                    {item.is_available ? (
                      <span className="flex items-center space-x-1 text-emerald-600 font-semibold text-[11px]">
                        <ToggleRight className="w-5 h-5" />
                        <span>In Stock</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-rose-500 font-semibold text-[11px]">
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span>Sold Out</span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Dish Name */}
                <h4 className="font-serif text-base font-bold text-gray-900 dark:text-white">
                  {item.name}
                </h4>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {item.description}
                </p>

                {/* Prices */}
                <div className="mt-3 flex items-baseline space-x-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase">Price: </span>
                    <span className="font-bold text-gray-900 dark:text-white font-sans text-sm">
                      ₹{item.price}
                    </span>
                  </div>
                  {item.chicken_price && (
                    <div className="text-rose-600 font-medium">
                      (Non-veg: ₹{item.chicken_price})
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Edit dish"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item)}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                  title="Delete dish"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Add Dish Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-xl w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-chili-600">
                {isNewItem ? 'New Menu Dish' : 'Edit Dish'}
              </span>
              <h3 className="font-serif text-xl font-bold text-gray-900 dark:text-white">
                {isNewItem ? 'Add a Dish to Menu' : `Edit "${name}"`}
              </h3>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Dish Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. TSG Special Cheese Burst Pizza"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Base / Veg Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white font-sans"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Chicken / Non-Veg Price (Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={chickenPrice}
                    onChange={(e) => setChickenPrice(e.target.value)}
                    placeholder="e.g. 149 (if dual priced)"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white font-sans"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Dish Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ingredients, flavors, preparation style..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Image Upload or URL */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Dish Image (Upload or URL)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setCompressionInfo(null);
                    }}
                    placeholder="Image URL or upload below..."
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                  />
                  <label className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 border border-gray-300 dark:border-gray-700 cursor-pointer flex items-center space-x-1 font-semibold text-gray-700 dark:text-gray-200">
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-chili-600" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploading ? 'Optimizing...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Live Image Preview & Compression Badge */}
                {imageUrl && (
                  <div className="mt-2 p-2 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0 border border-gray-300 dark:border-gray-600">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt="Dish Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/unnamed (2).webp';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                          Image Selected
                        </p>
                        {compressionInfo ? (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                            {compressionInfo}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {imageUrl.startsWith('/') ? 'Local / Uploaded Asset' : 'External Web URL'}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setCompressionInfo(null);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Checkboxes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVeg}
                    onChange={(e) => setIsVeg(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Pure Veg</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSpicy}
                    onChange={(e) => setIsSpicy(e.target.checked)}
                    className="rounded text-chili-600 focus:ring-chili-500"
                  />
                  <span className="font-medium">Spicy</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBestseller}
                    onChange={(e) => setIsBestseller(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium">Bestseller</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSpecial}
                    onChange={(e) => setIsSpecial(e.target.checked)}
                    className="rounded text-chili-600 focus:ring-chili-500"
                  />
                  <span className="font-medium">Chef Special</span>
                </label>
              </div>

              {/* In Stock & Sort Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-bold text-gray-900 dark:text-white">
                    Currently Available (In Stock)
                  </span>
                </label>

                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-white font-bold bg-chili-600 hover:bg-chili-700 shadow-sm flex items-center space-x-1.5 disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Dish</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
