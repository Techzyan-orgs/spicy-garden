# The Spicy Garden — Café & Bistro

Next.js 14 (App Router) site and owner portal, deployed on Vercel.

| Concern | Where it lives |
|---|---|
| Menu, categories, opening hours | Firebase Realtime Database (the only source; no built-in fallback) |
| WhatsApp subscribers | Firebase RTDB, phone/name encrypted (AES-256-GCM), HMAC phone index |
| Live orders | Ably (realtime + 24h history); not stored in the database |
| Menu images | Cloudinary |
| Rate limits, idempotency, session version | Firebase RTDB under `security/` |

## Local development

Requires **Node.js 22+**.

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run check` (both), `npm run build`.

## Environment variables

`.env.example` documents every variable. Required in every environment:

- `OWNER_EMAIL`, `OWNER_PASSWORD_HASH` (generate with `node scripts/hash-password.mjs`)
- `ADMIN_SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `PHONE_HASH_KEY` — three **different** random secrets of at least 32 characters:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_KEY` (base64 service-account JSON)
- `ABLY_API_KEY`
- `NEXT_PUBLIC_RESTAURANT_UPI_ID` (production builds fail without it)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (production image uploads)

Optional: WhatsApp Cloud API (`WHATSAPP_*`, including confirmation template names), `GOOGLE_MAPS_API_KEY`, analytics.

Never change `DATA_ENCRYPTION_KEY` or `PHONE_HASH_KEY` without re-running `scripts/migrate-subscribers.mjs`.

## Database rules

Browsers never talk to Firebase directly; the server uses the Admin SDK, which bypasses rules. Deploy the deny-all rules (plus indexes):

```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only database
```

## Maintenance scripts

All scripts read `.env.local`, default to a **dry run**, and write a backup to `./.backups/` before applying.

| Script | Purpose |
|---|---|
| `node scripts/hash-password.mjs` | Generate `OWNER_PASSWORD_HASH` |
| `node scripts/migrate-menu-to-keyed.mjs [--apply]` | One-time: array menu → keyed `menu/categories`, `menu/items` |
| `node scripts/seed-operations.mjs [--apply]` | Create `/operations` (opening hours) if it does not exist |
| `node scripts/migrate-subscribers.mjs [--apply] [--drop-unconsented] [--import-local]` | Re-encrypt subscribers with the current key, build the HMAC index, delete the legacy `whatsapp_subscribers` copy |

### First deployment order

1. Set all environment variables in Vercel (Production and Preview); set the Node.js version to 22.
2. `firebase deploy --only database`
3. Migrate data (once): `migrate-menu-to-keyed.mjs --apply`, `seed-operations.mjs --apply`, `migrate-subscribers.mjs --apply`.
4. Deploy the app.
5. After the subscriber migration succeeds, remove `LEGACY_DATA_ENCRYPTION_SECRET` if it was set.

## WhatsApp

- Customers join the offers list only by ticking the opt-in box (checkout, booking, or the pop-up). The exact wording and version are stored with each record (`src/lib/consentText.ts`).
- Opt-out: `/unsubscribe` (linked from every free-text broadcast) deletes the record.
- Broadcasts are sent in batches of 50 from the admin Marketing page. Use approved templates; free text only reaches customers who messaged you in the last 24 hours.
- Order/reservation confirmations use the templates named in `WHATSAPP_ORDER_TEMPLATE` / `WHATSAPP_RESERVATION_TEMPLATE` (max one per phone per 10 minutes). Nothing is sent when unset.
