export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export type PaymentMode = 'cash' | 'upi' | 'card' | 'online';

export interface OrderItemSnapshot {
  itemId: string;
  name: string;
  variant?: 'veg' | 'non-veg' | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DbCategory {
  id: string;
  label: string;
  icon?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active?: boolean;
}

export interface DbMenuItem {
  id: string;
  category_id?: string;
  category?: string;
  name: string;
  description: string;
  price: number;
  chicken_price?: number | null;
  chickenPrice?: number | null;
  is_veg?: boolean;
  isVeg?: boolean;
  is_spicy?: boolean;
  isSpicy?: boolean;
  is_bestseller?: boolean;
  isBestSeller?: boolean;
  is_special?: boolean;
  isSpecial?: boolean;
  image?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  is_available?: boolean;
  isAvailable?: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbOrder {
  id: string;
  order_number: number;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  items: OrderItemSnapshot[] | any;
  subtotal: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_mode: PaymentMode;
  upi_transaction_id?: string | null;
  paid_at?: string | null;
  source: string;
  notes?: string | null;
  delivery_address?: string | null;
  delivery_coordinates?: { lat: number; lng: number } | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at?: string;
  acknowledged_at?: string | null;
}

export interface DbWhatsAppConsent {
  id?: string;
  phone_number: string;
  customer_name?: string | null;
  consent_given: boolean;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}
