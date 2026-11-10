#!/usr/bin/env node
/**
 * Creates the initial /operations record (café timings) when it does not exist.
 * This is the ONLY place default hours live; the app itself never falls back
 * to them. Edit the values below to match the café before running.
 *
 * Usage:
 *   node scripts/seed-operations.mjs           # dry run
 *   node scripts/seed-operations.mjs --apply   # writes only if /operations is absent
 */
import { connect, APPLY } from './lib/firebase.mjs';

const INITIAL_OPERATIONS = {
  manualStatus: 'auto',
  manualStatusNote: '',
  updatedAt: new Date().toISOString(),
  updatedBy: 'seed-operations script',
  daysDisplay: 'Open All 7 Days',
  hoursDisplay: 'Mon–Thu, Sat–Sun: 2:00 PM – 11:30 PM | Fri: 1:00 PM – 11:00 PM',
  shortHoursDisplay: 'Mon–Thu, Sat–Sun: 2–11:30 PM • Fri: 1–11 PM',
  kitchenClosesDisplay: 'Last Kitchen Order: 30 minutes before closing',
  regularOpenHour24: 14.0,
  regularCloseHour24: 23.5,
  fridayOpenHour24: 13.0,
  fridayCloseHour24: 23.0,
  schedule: [
    { day: 'Monday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    { day: 'Tuesday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    { day: 'Wednesday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    { day: 'Thursday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    { day: 'Friday', open: '1:00 PM', close: '11:00 PM', isOpen: true },
    { day: 'Saturday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    { day: 'Sunday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
  ],
  closureNotice: { enabled: false, title: '', message: '', startDate: '', endDate: '', reason: 'Holiday' },
};

const db = connect();
const ref = db.ref('operations');
const existing = (await ref.once('value')).val();

if (existing) {
  console.log('/operations already exists — leaving it unchanged.');
  process.exit(0);
}
if (!APPLY) {
  console.log('Dry run: /operations is missing and would be created with:');
  console.log(JSON.stringify(INITIAL_OPERATIONS, null, 2));
  console.log('\nRe-run with --apply to write it.');
  process.exit(0);
}

// Transaction so a concurrent admin save is never overwritten.
const result = await ref.transaction((current) => (current === null ? INITIAL_OPERATIONS : undefined));
console.log(result.committed ? '/operations created.' : '/operations was created concurrently — left unchanged.');
process.exit(0);
