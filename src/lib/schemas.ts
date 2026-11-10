/**
 * Request schemas for public and admin API routes (zod).
 * Unknown keys are stripped; every string has a length cap.
 */
import { z } from 'zod';

/** Optional free text: trims, caps length, and treats "" as absent. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Normalises "+91 98765-43210" → "9876543210" (last 10 digits). */
export function normalizePhone(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-10);
}

export const orderItemSchema = z.object({
  itemId: z.string().regex(SAFE_ID, 'invalid item id'),
  variant: z.enum(['veg', 'non-veg']).optional().nullable().transform((v) => v ?? undefined),
  // Dishes are capped at 20 per line in the handler; reservations use this as the guest count.
  quantity: z.coerce.number().int().min(1).max(100),
});

export const ORDER_TYPES = ['delivery', 'takeaway', 'dine-in', 'reservation'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const createOrderSchema = z.object({
  customerName: optionalText(80),
  customerPhone: z.string().max(20).optional(),
  items: z.array(orderItemSchema).max(50, 'too many items in one order').default([]),
  notes: optionalText(500),
  deliveryAddress: optionalText(300),
  deliveryCoordinates: z
    .object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
    })
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  orderType: z.enum(ORDER_TYPES).optional(),
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,100}$/, 'invalid idempotency key')
    .optional(),
  /** Display label only (e.g. "Celebration: Birthday (4 Guests…)"). Never used for authorisation. */
  source: optionalText(160),
  paymentMode: z.enum(['cash', 'upi']).optional(),
  upiTransactionId: optionalText(35).refine(
    (v) => v === undefined || /^[A-Za-z0-9]{6,35}$/.test(v),
    'UPI reference must be 6–35 letters or digits'
  ),
  // Admin-only fields (ignored for public requests)
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['paid', 'unpaid']).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderActionSchema = z.object({
  orderId: z.string().regex(SAFE_ID, 'invalid order id'),
  action: z.enum(['acknowledge', 'handled']),
});

export const consentSchema = z.object({
  phone: z.string().max(20),
  customerName: optionalText(100),
  source: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,50}$/, 'invalid source')
    .optional(),
  metadata: z
    .object({
      interestScore: z.coerce.number().int().min(0).max(1000).optional(),
    })
    .passthrough()
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(256),
});

export const subscriberIdSchema = z.string().regex(/^sub_[A-Za-z0-9_]{1,100}$/, 'invalid subscriber id');
