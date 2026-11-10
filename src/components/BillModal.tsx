'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, MessageCircle } from 'lucide-react';
import { generateQrDataUrl } from '@/lib/qrCode';
import { RESTAURANT_UPI_ID, isUpiConfigured, buildUpiPaymentUrl } from '@/lib/publicConfig';

export interface BillOrderItem {
  itemId?: string;
  name: string;
  variant?: 'veg' | 'non-veg' | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface BillOrderData {
  id?: string;
  order_number: number | string;
  customer_name: string;
  customer_phone: string;
  items: BillOrderItem[] | any;
  subtotal?: number;
  total: number;
  notes?: string | null;
  delivery_address?: string | null;
  created_at?: string;
  status?: string;
  payment_status?: string;
  payment_mode?: string;
  upi_transaction_id?: string | null;
  paid_at?: string | null;
  source?: string;
}

interface BillModalProps {
  order: BillOrderData | null;
  isOpen: boolean;
  onClose: () => void;
}

// Convert numbers to Indian Rupees in words
function numberToWordsINR(amount: number): string {
  const num = Math.round(amount);
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000)
      return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000)
      return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000)
      return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  return inWords(num) + ' Rupees Only';
}

export default function BillModal({ order, isOpen, onClose }: BillModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // All hooks run on every render (before the early return below) — React requires a stable hook order.
  const hookTotal = Number(order?.total) || 0;
  const hookOrderNum = order ? String(order.order_number).padStart(4, '0') : '';
  const upiUrl = isOpen && order ? buildUpiPaymentUrl(hookTotal, `Bill SG-${hookOrderNum}`) : null;
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    setQrCodeUrl(''); // never show the previous bill's QR code
    if (upiUrl) {
      generateQrDataUrl(upiUrl, 130).then((dataUrl) => {
        if (dataUrl) setQrCodeUrl(dataUrl);
      });
    }
  }, [upiUrl]);

  // Lock body scroll and prevent background scroll chaining while BillModal is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Track backdrop pointer down to prevent closing when dragging/selecting text from inside the bill receipt
  const isBackdropMouseDownRef = useRef(false);

  if (!isOpen || !order) return null;

  const rawItems: BillOrderItem[] = Array.isArray(order.items) ? order.items : [];
  const grandTotal = Number(order.total) || 0;
  
  // Tax breakdown (All-inclusive GST 5% = 2.5% CGST + 2.5% SGST)
  const taxableSubtotal = Math.round((grandTotal / 1.05) * 100) / 100;
  const totalGst = Math.round((grandTotal - taxableSubtotal) * 100) / 100;
  const halfGst = Math.round((totalGst / 2) * 100) / 100;

  const dateObj = order.created_at ? new Date(order.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const orderNumStr = hookOrderNum;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isBackdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isBackdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    isBackdropMouseDownRef.current = false;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const lines = [
      `*🧾 THE SPICY GARDEN - BILL RECEIPT*`,
      `Order: #SG-${orderNumStr}`,
      `Date: ${formattedDate}, ${formattedTime}`,
      `Customer: ${order.customer_name} (${order.customer_phone})`,
      ...(order.source ? [`Service: ${order.source}`] : []),
      ...(order.delivery_address ? [`Delivery To: ${order.delivery_address}`] : []),
      `-----------------------------`,
      ...rawItems.map(
        (i) => `${i.quantity}x ${i.name}${i.variant ? ` [${i.variant}]` : ''} - ₹${i.totalPrice}`
      ),
      `-----------------------------`,
      `*Total Amount: ₹${grandTotal}*`,
      `Taxes: GST 5% Included (CGST ₹${halfGst} + SGST ₹${halfGst})`,
      `Payment: ${order.payment_status === 'paid' ? `PAID (${(order.payment_mode || 'UPI').toUpperCase()})` : 'UNPAID'}`,
      ...(isUpiConfigured ? [`UPI Pay: ${RESTAURANT_UPI_ID}`] : []),
      `Thank you for visiting The Spicy Garden!`,
    ];
    const text = encodeURIComponent(lines.join('\n'));
    const phone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
    const waUrl = phone.length >= 10
      ? `https://wa.me/91${phone.slice(-10)}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank');
  };

  return (
    <>
      {/* Print-specific stylesheet for small 80mm paper / thermal receipt */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #sg-bill-receipt,
          #sg-bill-receipt * {
            visibility: visible !important;
          }
          #sg-bill-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 78mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Modal Backdrop */}
      <div
        onMouseDown={handleBackdropMouseDown}
        onTouchStart={handleBackdropTouchStart}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      >
        <div
          onMouseDown={(e) => {
            isBackdropMouseDownRef.current = false;
            e.stopPropagation();
          }}
          onTouchStart={() => {
            isBackdropMouseDownRef.current = false;
          }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[360px] my-auto flex flex-col items-center overscroll-contain"
        >
          
          {/* Action Toolbar (Hidden during print) */}
          <div className="w-full flex items-center justify-between gap-2 mb-2.5 px-1 print:hidden">
            <div className="flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white text-black border border-gray-300 shadow-sm">
                #SG-{orderNumStr}
              </span>
              <span className="text-xs text-white/90 font-medium">B&W POS Receipt</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-black hover:bg-gray-100 shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Print Black & White Receipt"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="p-1.5 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Share via WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close receipt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INK-EFFICIENT BLACK & WHITE SMALL PAPER RECEIPT (80mm Thermal / POS Style) */}
          {/* ========================================================================= */}
          <div
            id="sg-bill-receipt"
            ref={receiptRef}
            className="w-full bg-white text-black p-4 sm:p-5 rounded-none sm:rounded-2xl border-2 border-black shadow-2xl font-mono text-[11px] leading-relaxed selection:bg-black selection:text-white"
          >
            {/* Restaurant Header */}
            <div className="text-center space-y-0.5">
              <h2 className="font-serif text-base font-extrabold tracking-wider uppercase text-black">
                THE SPICY GARDEN
              </h2>
              <p className="text-[10px] font-sans font-bold tracking-widest uppercase text-black">
                CAFE & BISTRO
              </p>
              <p className="text-[9.5px] leading-tight text-black pt-0.5">
                1/G-1, Ashwini Nagar, Baguiati
                <br />
                Kolkata, West Bengal - 700159
              </p>
              <p className="text-[10px] font-bold text-black">
                Tel: +91 87778 66602
              </p>
              <p className="text-[9px] text-black">
                SAC: 996331 | All-Inclusive Cafe Tax Invoice
              </p>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-black my-2.5" />

            {/* Bill & Customer Metadata */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="font-bold">INVOICE NO:</span>
                <span className="font-bold">#SG-{orderNumStr}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE/TIME:</span>
                <span>{formattedDate}, {formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span>CUSTOMER:</span>
                <span className="font-bold truncate max-w-[160px]">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span>PHONE:</span>
                <span>{order.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span>ORDER TYPE:</span>
                <span className="uppercase font-bold">{order.source === 'Takeaway' ? 'Takeaway / Parcel' : (order.source || 'Takeaway / Parcel')}</span>
              </div>
              {order.delivery_address && (
                <div className="flex justify-between items-start pt-0.5">
                  <span className="font-bold flex-shrink-0 mr-2">DELIVERY TO:</span>
                  <span className="text-right font-medium leading-tight max-w-[170px] break-words">
                    {order.delivery_address}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>STATUS:</span>
                <span className="uppercase font-bold">{order.status || 'Confirmed'}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span>PAYMENT:</span>
                <span
                  className={`uppercase font-black ${
                    order.payment_status === 'paid'
                      ? 'px-1 py-0.2 border border-black text-[9px]'
                      : 'text-[9px] font-bold'
                  }`}
                >
                  {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>PAYMENT MODE:</span>
                <span className="uppercase font-bold">
                  {order.payment_mode
                    ? String(order.payment_mode).toUpperCase()
                    : order.payment_status === 'paid'
                    ? 'UPI'
                    : 'CASH / ON DELIVERY'}
                </span>
              </div>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-black my-2.5" />

            {/* Items Table Header */}
            <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-black">
              <span className="w-7">QTY</span>
              <span className="flex-1 text-left px-1">ITEM</span>
              <span className="w-12 text-right">RATE</span>
              <span className="w-14 text-right">TOTAL</span>
            </div>

            {/* Items Rows */}
            <div className="divide-y divide-dashed divide-black/40 py-1 space-y-1">
              {rawItems.map((item, idx) => (
                <div key={idx} className="pt-1 text-[10.5px]">
                  <div className="flex justify-between items-start">
                    <span className="w-7 font-bold">{item.quantity}x</span>
                    <span className="flex-1 text-left px-1 font-sans font-bold leading-tight">
                      {item.variant ? (item.variant === 'veg' ? '[V] ' : '[NV] ') : ''}
                      {item.name}
                    </span>
                    <span className="w-12 text-right">₹{item.unitPrice}</span>
                    <span className="w-14 text-right font-bold">₹{item.totalPrice}</span>
                  </div>
                  {item.variant && (
                    <div className="pl-7 text-[9px] text-black">
                      Pref: {item.variant === 'veg' ? 'Vegetarian' : 'Chicken / Non-Veg'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-black my-2.5" />

            {/* Financial Breakdown */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Net Item Subtotal:</span>
                <span>₹{taxableSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST @ 2.5%:</span>
                <span>₹{halfGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST @ 2.5%:</span>
                <span>₹{halfGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Taxes:</span>
                <span>All GST 5% Included</span>
              </div>
            </div>

            {/* Grand Total Bar */}
            <div className="border-t-2 border-b-2 border-black my-2 py-1 flex justify-between items-baseline font-bold text-xs">
              <span className="tracking-wider">TOTAL AMOUNT:</span>
              <span className="text-sm font-extrabold">₹{grandTotal}</span>
            </div>

            {/* Amount in Words */}
            <div className="text-[9.5px] italic text-center px-1 pb-1">
              ({numberToWordsINR(grandTotal)})
            </div>

            {/* Cooking Notes */}
            {order.notes && (
              <div className="my-1.5 p-1.5 border border-dashed border-black text-[9.5px]">
                <span className="font-bold">Instructions: </span>
                <span>{order.notes}</span>
              </div>
            )}

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-black my-2.5" />

            {/* Payment Section: PAID Stamp vs Scan & Pay QR */}
            {order.payment_status === 'paid' ? (
              <div className="my-2 py-2 px-3 border-2 border-dashed border-black text-center space-y-0.5">
                <p className="text-[12px] font-black tracking-widest uppercase">
                  ★ PAID IN FULL ★
                </p>
                <p className="text-[9px] font-bold">
                  MODE: {String(order.payment_mode || 'UPI').toUpperCase()}
                  {order.upi_transaction_id ? ` • UTR: ${order.upi_transaction_id}` : ''}
                </p>
                <p className="text-[8px] text-black italic">
                  Receipt of settled bill. Thank you!
                </p>
              </div>
            ) : isUpiConfigured && qrCodeUrl ? (
              <div className="flex flex-col items-center justify-center text-center space-y-1 py-1">
                <div className="p-1 border border-black bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="Scan to Pay UPI"
                    width={96}
                    height={96}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-wide">
                  SCAN WITH ANY UPI APP TO PAY
                </p>
                <p className="text-[8.5px]">UPI ID: {RESTAURANT_UPI_ID}</p>
              </div>
            ) : (
              <div className="my-2 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wide">PAYMENT DUE AT COUNTER</p>
              </div>
            )}

            {/* Simulated Vector Barcode */}
            <div className="my-2.5 flex flex-col items-center">
              <div className="flex items-center space-x-[2px] h-6 overflow-hidden">
                {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3].map(
                  (w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w}px` }}
                      className="h-full bg-black"
                    />
                  )
                )}
              </div>
              <span className="text-[8px] font-mono tracking-widest mt-0.5">
                *SG-{orderNumStr}*
              </span>
            </div>

            {/* Footer Message */}
            <div className="text-center text-[9px] pt-1 border-t border-dashed border-black space-y-0.5">
              <p className="font-bold">Good Food. Good Mood.</p>
              <p>Thank you for choosing The Spicy Garden!</p>
              <p className="font-bold tracking-wider">*** VISIT AGAIN ***</p>
            </div>

          </div>

          {/* Print Notice (Hidden during print) */}
          <p className="text-[10px] text-gray-400 text-center mt-2.5 print:hidden">
            Optimized for 80mm thermal rolls & B&W laser printers (zero color ink).
          </p>

        </div>
      </div>
    </>
  );
}
