"use client";

import React, { useEffect, useRef, useState } from "react";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { WHATSAPP_CONSENT_TEXT } from "@/lib/consentText";
import {
  X,
  Calendar,
  Clock,
  Users,
  Phone,
  User,
  MessageSquare,
  PartyPopper,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOccasion?: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  occasion?: string;
  guests?: string;
  date?: string;
  time?: string;
  notes?: string;
}

interface FormTouched {
  name?: boolean;
  phone?: boolean;
  occasion?: boolean;
  guests?: boolean;
  date?: boolean;
  time?: boolean;
  notes?: boolean;
}

// Helper date utilities
const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTomorrowDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMaxDateString = (daysAhead = 60): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isFridayDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getDay() === 5;
};

// Field validation functions
const validateNameValue = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) return "Please enter your full name.";
  if (trimmed.length < 2) return "Name must be at least 2 characters long.";
  if (trimmed.length > 50) return "Name cannot exceed 50 characters.";
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return "Name can only contain letters and spaces.";
  }
  return null;
};

const validatePhoneValue = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) return "Please enter your mobile phone number.";
  const digits = trimmed.replace(/\D/g, "");
  let normalized = digits;
  if (digits.length === 12 && digits.startsWith("91")) {
    normalized = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    normalized = digits.slice(1);
  }

  if (normalized.length !== 10) {
    return "Please enter a valid 10-digit mobile number.";
  }
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return "Mobile number must start with 6, 7, 8, or 9.";
  }
  return null;
};

const validateOccasionValue = (val: string): string | null => {
  if (!val || !val.trim()) return "Please select an occasion or purpose.";
  return null;
};

const validateGuestsValue = (val: string): string | null => {
  if (!val || !val.toString().trim()) return "Please specify number of guests.";
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1) return "Minimum 1 guest is required.";
  if (num > 40) return "For parties over 40 guests, please call cafe manager directly.";
  return null;
};

const validateDateValue = (val: string): string | null => {
  if (!val) return "Please select a reservation date.";
  const todayStr = getTodayDateString();
  const maxStr = getMaxDateString(60);
  if (val < todayStr) return "Reservation date cannot be in the past.";
  if (val > maxStr) return "Reservations are accepted up to 60 days in advance.";
  return null;
};

const validateTimeValue = (timeVal: string, dateVal: string): string | null => {
  if (!timeVal) return "Please select a booking time.";
  const parts = timeVal.split(":");
  if (parts.length < 2) return "Please enter a valid time.";
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "Please enter a valid time.";
  }

  const totalMinutes = hours * 60 + minutes;
  const isFriday = isFridayDate(dateVal);

  // Friday: 1:00 PM (13:00) to 11:00 PM (23:00). Last reservation accepted at 10:30 PM (22:30).
  // Mon-Thu, Sat-Sun: 2:00 PM (14:00) to 11:30 PM (23:30). Last reservation accepted at 11:00 PM (23:00).
  const openMin = isFriday ? 13 * 60 : 14 * 60; // 780 or 840
  const lastBookingMin = isFriday ? 22 * 60 + 30 : 23 * 60; // 1350 or 1380

  if (totalMinutes < openMin) {
    return isFriday
      ? "On Fridays, we open at 1:00 PM. Please select 1:00 PM – 10:30 PM."
      : "Restaurant opens at 2:00 PM. Please select 2:00 PM – 11:00 PM.";
  }

  if (totalMinutes > lastBookingMin) {
    return isFriday
      ? "On Fridays, last table booking is at 10:30 PM."
      : "Last table booking is at 11:00 PM.";
  }

  // If date is today, check if time has already passed
  const todayStr = getTodayDateString();
  if (dateVal === todayStr) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (totalMinutes <= nowMinutes + 15) {
      return "For today, please choose a time at least 30 minutes from now.";
    }
  }

  return null;
};

const validateNotesValue = (val: string): string | null => {
  if (val && val.length > 300) {
    return "Special requests must not exceed 300 characters.";
  }
  return null;
};

export default function ReservationModal({ isOpen, onClose, defaultOccasion }: ReservationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Field element refs for auto-focusing on first error
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const occasionRef = useRef<HTMLSelectElement>(null);
  const guestsRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Form input states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // WhatsApp offers opt-in: unticked by default, only sent when the guest ticks it.
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [occasion, setOccasion] = useState(defaultOccasion || "Birthday Celebration");
  const [guests, setGuests] = useState("4");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [notes, setNotes] = useState("");

  // Validation states
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<number | string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  // Auto-initialize intelligent default date & time when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const currentHours = now.getHours() + now.getMinutes() / 60;
      
      // If past 10:30 PM today, default to tomorrow
      if (currentHours >= 22.5) {
        setDate(getTomorrowDateString());
        setTime("19:00");
      } else {
        setDate(getTodayDateString());
        // If before opening hours, default to 7:00 PM
        if (currentHours < 14) {
          setTime("19:00");
        } else {
          // Default to 1 hour ahead rounded to nearest 15 mins
          const targetHour = Math.min(Math.floor(currentHours + 1), 22);
          setTime(`${String(targetHour).padStart(2, "0")}:00`);
        }
      }
      setErrors({});
      setTouched({});
      setSubmitAttempted(false);
      setSubmitted(false);
      setIsSubmitting(false);
      setSubmitError(null);
      setBookingRef(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (defaultOccasion) {
      setOccasion(defaultOccasion);
    }
  }, [defaultOccasion]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }
      setSubmitted(false);
    }

    let isBackdropMouseDown = false;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.target !== dialog) {
        isBackdropMouseDown = false;
        return;
      }
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      isBackdropMouseDown = !isInside;
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (!isBackdropMouseDown || event.target !== dialog) {
        isBackdropMouseDown = false;
        return;
      }
      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        onClose();
      }
      isBackdropMouseDown = false;
    };

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("mousedown", handleMouseDown);
    dialog.addEventListener("click", handleBackdropClick);
    dialog.addEventListener("cancel", handleCancel);

    return () => {
      dialog.removeEventListener("mousedown", handleMouseDown);
      dialog.removeEventListener("click", handleBackdropClick);
      dialog.removeEventListener("cancel", handleCancel);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen, onClose]);

  // Real-time re-validation of time when date changes
  useEffect(() => {
    if (date && time && (touched.time || submitAttempted)) {
      const timeErr = validateTimeValue(time, date);
      setErrors((prev) => ({ ...prev, time: timeErr || undefined }));
    }
  }, [date]);

  // Handle onBlur field validation
  const handleBlur = (field: keyof FormTouched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let errorMsg: string | null = null;
    switch (field) {
      case "name":
        errorMsg = validateNameValue(name);
        break;
      case "phone":
        errorMsg = validatePhoneValue(phone);
        break;
      case "occasion":
        errorMsg = validateOccasionValue(occasion);
        break;
      case "guests":
        errorMsg = validateGuestsValue(guests);
        break;
      case "date":
        errorMsg = validateDateValue(date);
        break;
      case "time":
        errorMsg = validateTimeValue(time, date);
        break;
      case "notes":
        errorMsg = validateNotesValue(notes);
        break;
    }
    setErrors((prev) => ({ ...prev, [field]: errorMsg || undefined }));
  };

  const handleFieldChange = (field: keyof FormTouched, value: string) => {
    // Update value
    switch (field) {
      case "name":
        setName(value);
        if (touched.name || submitAttempted) {
          setErrors((prev) => ({ ...prev, name: validateNameValue(value) || undefined }));
        }
        break;
      case "phone":
        setPhone(value);
        if (touched.phone || submitAttempted) {
          setErrors((prev) => ({ ...prev, phone: validatePhoneValue(value) || undefined }));
        }
        break;
      case "occasion":
        setOccasion(value);
        if (touched.occasion || submitAttempted) {
          setErrors((prev) => ({ ...prev, occasion: validateOccasionValue(value) || undefined }));
        }
        break;
      case "guests":
        setGuests(value);
        if (touched.guests || submitAttempted) {
          setErrors((prev) => ({ ...prev, guests: validateGuestsValue(value) || undefined }));
        }
        break;
      case "date":
        setDate(value);
        if (touched.date || submitAttempted) {
          setErrors((prev) => ({ ...prev, date: validateDateValue(value) || undefined }));
        }
        break;
      case "time":
        setTime(value);
        if (touched.time || submitAttempted) {
          setErrors((prev) => ({ ...prev, time: validateTimeValue(value, date) || undefined }));
        }
        break;
      case "notes":
        setNotes(value);
        if (touched.notes || submitAttempted) {
          setErrors((prev) => ({ ...prev, notes: validateNotesValue(value) || undefined }));
        }
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const nameErr = validateNameValue(name);
    const phoneErr = validatePhoneValue(phone);
    const occasionErr = validateOccasionValue(occasion);
    const guestsErr = validateGuestsValue(guests);
    const dateErr = validateDateValue(date);
    const timeErr = validateTimeValue(time, date);
    const notesErr = validateNotesValue(notes);

    const validationResults: FormErrors = {
      name: nameErr || undefined,
      phone: phoneErr || undefined,
      occasion: occasionErr || undefined,
      guests: guestsErr || undefined,
      date: dateErr || undefined,
      time: timeErr || undefined,
      notes: notesErr || undefined,
    };

    setErrors(validationResults);
    setTouched({
      name: true,
      phone: true,
      occasion: true,
      guests: true,
      date: true,
      time: true,
      notes: true,
    });

    // Auto-focus on the first field with an error
    if (nameErr) {
      nameRef.current?.focus();
      return;
    }
    if (phoneErr) {
      phoneRef.current?.focus();
      return;
    }
    if (occasionErr) {
      occasionRef.current?.focus();
      return;
    }
    if (guestsErr) {
      guestsRef.current?.focus();
      return;
    }
    if (dateErr) {
      dateRef.current?.focus();
      return;
    }
    if (timeErr) {
      timeRef.current?.focus();
      return;
    }
    if (notesErr) {
      notesRef.current?.focus();
      return;
    }

    // Format human-friendly date for reservation
    const formattedDate = date
      ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      : "Today";

    // Clean phone number for contact
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);

    const celebrationSource = `Celebration: ${occasion} (${guests} Guests, ${formattedDate} at ${time})`;
    const reservationNotes = [
      `Occasion: ${occasion}`,
      `Guests: ${guests} Person${Number(guests) > 1 ? 's' : ''}`,
      `Date: ${formattedDate}`,
      `Time: ${time}`,
      notes.trim() ? `Special Requests: ${notes.trim()}` : null,
    ].filter(Boolean).join(" | ");

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: cleanPhone,
          orderType: 'reservation',
          source: celebrationSource,
          whatsappOptIn,
          notes: reservationNotes,
          items: [
            {
              itemId: 'reservation',
              quantity: Number(guests) || 1,
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit celebration booking. Please try again.');
      }

      const orderNumber = data.order?.order_number || (data.orderNumber ? String(data.orderNumber).replace('#SG-', '') : null);
      setBookingRef(orderNumber);

      // Broadcast order event to any open admin portals/tabs in the same browser
      if (typeof window !== 'undefined') {
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('sg_orders_channel');
            bc.postMessage({ type: 'NEW_ORDER', order: data.order });
            bc.close();
          } catch {}
        }
        window.dispatchEvent(new CustomEvent('sg_new_order', { detail: data.order }));
      }

      // WhatsApp offers sign-up happens server-side only when the guest ticked the opt-in box.

      // Prepare optional WhatsApp URL for customer convenience (does NOT open automatically)
      const message = `Hello ${RESTAURANT_DATA.brand.shortName}! I submitted a Celebration Booking (#SG-${orderNumber || 'PENDING'}):
• Name: ${name.trim()}
• Contact: ${cleanPhone}
• Occasion: ${occasion}
• Guests: ${guests}
• Date: ${formattedDate}
• Preferred Time: ${time}
${notes.trim() ? `• Special Requests: ${notes.trim()}` : ""}`;
      const encoded = encodeURIComponent(message);
      const waUrl = `https://wa.me/${RESTAURANT_DATA.contact.whatsappNumber}?text=${encoded}`;
      setWhatsappUrl(waUrl);

      setSubmitted(true);
    } catch (err: any) {
      console.error('[Reservation] Failed to send reservation to admin:', err);
      setSubmitError(err.message || 'Unable to submit reservation. Please try again or call us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFriday = isFridayDate(date);
  const minDate = getTodayDateString();
  const maxDate = getMaxDateString(60);
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <dialog
      ref={dialogRef}
      // @ts-ignore: closedby is standard per modern web guidance
      closedby="any"
      aria-labelledby="modal-title"
      className="backdrop:bg-black/60 backdrop:backdrop-blur-sm p-0 m-auto rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-lg w-full max-h-[92vh] overflow-y-auto overscroll-contain"
    >
      <div className="relative p-6 sm:p-8">
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-6 text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <PartyPopper className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-bold font-serif text-gray-900 dark:text-white">
              Celebration Request Sent to Admin!
            </h3>
            <p className="mt-1.5 text-gray-600 dark:text-gray-300 max-w-sm text-sm">
              Your table reservation details have been received directly at our restaurant admin portal and kitchen desk.
            </p>

            {/* Booking Details Card */}
            <div className="mt-5 w-full bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Booking Reference</span>
                <span className="font-mono font-extrabold text-sm text-chili-600 dark:text-chili-400">
                  #SG-{bookingRef || 'CONFIRMED'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-gray-800 dark:text-gray-200">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Occasion</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{occasion}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Party Size</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{guests} Guests</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Date</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {date
                      ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short"
                        })
                      : "Today"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Time</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{time}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] text-gray-600 dark:text-gray-400">
                Our team will call or WhatsApp <strong>{phone}</strong> to confirm your reservation.
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-5 rounded-xl bg-chili-600 hover:bg-chili-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center"
              >
                Done / Close Window
              </button>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-center space-x-1.5 cursor-pointer text-center"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Optional: Chat on WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 rounded-xl bg-chili-50 dark:bg-chili-950/50 text-chili-600 dark:text-chili-400 border border-chili-200 dark:border-chili-900/40">
                <PartyPopper className="w-6 h-6" />
              </div>
              <div>
                <h2 id="modal-title" className="text-2xl font-bold font-serif text-gray-900 dark:text-white">
                  Book Table / Celebration
                </h2>
                <p className="text-xs text-chili-600 dark:text-chili-400 font-medium">
                  {RESTAURANT_DATA.brand.tagline}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Reserve your table or plan your birthday, anniversary, or office party. All details are validated before connecting to our manager.
            </p>

            {/* Error Summary Alert Banner */}
            {submitAttempted && hasErrors && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Please fix the highlighted fields below before submitting your booking.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Name Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="booking-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  {touched.name && !errors.name && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-0.5">
                      <span>✓ Valid</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    ref={nameRef}
                    id="booking-name"
                    type="text"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    placeholder="e.g. Rahul Sharma"
                    aria-invalid={touched.name && !!errors.name}
                    aria-describedby={errors.name ? "name-error" : undefined}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      touched.name && errors.name
                        ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                        : touched.name && !errors.name
                        ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-gray-800 focus:ring-chili-500"
                        : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                    }`}
                  />
                </div>
                {touched.name && errors.name && (
                  <p id="name-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Phone & Occasion Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="booking-phone" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    {touched.phone && !errors.phone && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-0.5">
                        <span>✓ Valid</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      ref={phoneRef}
                      id="booking-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      onBlur={() => handleBlur("phone")}
                      placeholder="e.g. 9876543210"
                      aria-invalid={touched.phone && !!errors.phone}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                        touched.phone && errors.phone
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                          : touched.phone && !errors.phone
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-gray-800 focus:ring-chili-500"
                          : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                      }`}
                    />
                  </div>
                  {touched.phone && errors.phone ? (
                    <p id="phone-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.phone}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-400">10-digit mobile number starting with 6-9</p>
                  )}
                  <label className="mt-2 flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappOptIn}
                      onChange={(e) => setWhatsappOptIn(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{WHATSAPP_CONSENT_TEXT} (Optional)</span>
                  </label>
                </div>

                {/* Occasion Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="booking-occasion" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Occasion / Purpose <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <select
                    ref={occasionRef}
                    id="booking-occasion"
                    value={occasion}
                    onChange={(e) => handleFieldChange("occasion", e.target.value)}
                    onBlur={() => handleBlur("occasion")}
                    aria-invalid={touched.occasion && !!errors.occasion}
                    aria-describedby={errors.occasion ? "occasion-error" : undefined}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      touched.occasion && errors.occasion
                        ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                        : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                    }`}
                  >
                    <option value="Birthday Celebration">🎂 Birthday Celebration</option>
                    <option value="Anniversary Party">❤️ Anniversary Celebration</option>
                    <option value="Kitty Party">🎉 Kitty Party</option>
                    <option value="Office Party">💼 Office Gathering / Team Lunch</option>
                    <option value="Casual Dine-In Table">🍽️ Casual Table Reservation</option>
                    <option value="Match Screening Night">🏏 Cricket Match Hangout</option>
                  </select>
                  {touched.occasion && errors.occasion && (
                    <p id="occasion-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.occasion}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Guests, Date, and Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Guests */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="booking-guests" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Guests <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-gray-400">1 – 40</span>
                  </div>
                  <div className="relative">
                    <Users className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      ref={guestsRef}
                      id="booking-guests"
                      type="number"
                      min={1}
                      max={40}
                      required
                      value={guests}
                      onChange={(e) => handleFieldChange("guests", e.target.value)}
                      onBlur={() => handleBlur("guests")}
                      aria-invalid={touched.guests && !!errors.guests}
                      aria-describedby={errors.guests ? "guests-error" : undefined}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                        touched.guests && errors.guests
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                          : touched.guests && !errors.guests
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-gray-800 focus:ring-chili-500"
                          : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                      }`}
                    />
                  </div>
                  {touched.guests && errors.guests && (
                    <p id="guests-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.guests}</span>
                    </p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="booking-date" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Date <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      ref={dateRef}
                      id="booking-date"
                      type="date"
                      min={minDate}
                      max={maxDate}
                      required
                      value={date}
                      onChange={(e) => handleFieldChange("date", e.target.value)}
                      onBlur={() => handleBlur("date")}
                      aria-invalid={touched.date && !!errors.date}
                      aria-describedby={errors.date ? "date-error" : undefined}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                        touched.date && errors.date
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                          : touched.date && !errors.date
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-gray-800 focus:ring-chili-500"
                          : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                      }`}
                    />
                  </div>
                  {touched.date && errors.date && (
                    <p id="date-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.date}</span>
                    </p>
                  )}
                </div>

                {/* Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="booking-time" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Time <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      ref={timeRef}
                      id="booking-time"
                      type="time"
                      required
                      value={time}
                      onChange={(e) => handleFieldChange("time", e.target.value)}
                      onBlur={() => handleBlur("time")}
                      aria-invalid={touched.time && !!errors.time}
                      aria-describedby={errors.time ? "time-error" : undefined}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                        touched.time && errors.time
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                          : touched.time && !errors.time
                          ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-gray-800 focus:ring-chili-500"
                          : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                      }`}
                    />
                  </div>
                  {touched.time && errors.time && (
                    <p id="time-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.time}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Operating Hours Contextual Hint */}
              <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 text-[11px] text-gray-600 dark:text-gray-300 flex items-start space-x-2">
                <Info className="w-4 h-4 text-garden-600 dark:text-garden-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isFriday ? "Friday Hours (1:00 PM – 11:00 PM):" : "Mon–Thu & Sat–Sun Hours (2:00 PM – 11:30 PM):"}
                  </span>{" "}
                  {isFriday
                    ? "Kitchen closes at 10:30 PM. Table bookings accepted between 1:00 PM and 10:30 PM."
                    : "Kitchen closes at 11:00 PM. Table bookings accepted between 2:00 PM and 11:00 PM."}
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="booking-notes" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Special Requests (Optional)
                  </label>
                  <span className={`text-[10px] ${notes.length > 300 ? "text-rose-500 font-bold" : "text-gray-400"}`}>
                    {notes.length} / 300
                  </span>
                </div>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <textarea
                    ref={notesRef}
                    id="booking-notes"
                    rows={2}
                    maxLength={300}
                    value={notes}
                    onChange={(e) => handleFieldChange("notes", e.target.value)}
                    onBlur={() => handleBlur("notes")}
                    placeholder="E.g., Cake cutting arrangement, window booth, decoration themes, food preferences..."
                    aria-invalid={touched.notes && !!errors.notes}
                    aria-describedby={errors.notes ? "notes-error" : undefined}
                    className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      touched.notes && errors.notes
                        ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:ring-rose-500"
                        : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-chili-500"
                    }`}
                  />
                </div>
                {touched.notes && errors.notes && (
                  <p id="notes-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.notes}</span>
                  </p>
                )}
              </div>

              {/* Submit Error Banner */}
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-chili-600 hover:bg-chili-700 active:scale-[0.98] transition-all shadow-lg shadow-chili-600/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending to Admin Portal...</span>
                    </>
                  ) : (
                    <>
                      <PartyPopper className="w-4 h-4" />
                      <span>Confirm & Book Celebration</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
                Prefer to call directly? Tap to call{" "}
                <a href={RESTAURANT_DATA.contact.telLink} className="text-chili-600 dark:text-chili-400 font-bold underline">
                  {RESTAURANT_DATA.contact.displayPhone}
                </a>
              </p>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
