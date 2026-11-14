import assert from 'node:assert/strict';
import {
  DEFAULT_CONTACT, DEFAULT_PAUSE_MESSAGE, PAYMENT_LABELS,
  cutoffSentence, dayOffLabel, feeLabel, formatTime, groupHours, shopContact,
} from '../../frontend/src/lib/shopSettings.ts';
import {formatPeso} from '../../frontend/src/pages/dashboard/report-format.ts';

const day = (weekday, opens, closes) => ({weekday, is_open: opens !== null, opens, closes});
const week = (rows = {}) => Array.from({length: 7}, (_, weekday) => rows[weekday] ?? day(weekday, '09:00', '18:00'));
const loaded = {
  messenger_url: 'https://m.me/rowszeinsdelight', facebook_url: 'https://www.facebook.com/rowszeinsdelight',
  email: 'hello@rowszeinsdelight.com', phone: '0917 123 4567', notice: '', orders_paused: false, pause_message: '',
  lead_days: 1, order_cutoff: null, payment_methods: [], hours: [], towns: [], days_off: [],
};

const tests = [];
tests.push(['defaults cover loading and failure; loaded settings are the truth', () => {
  assert.deepEqual(shopContact(undefined), DEFAULT_CONTACT);
  assert.equal(DEFAULT_CONTACT.messenger_url, 'https://m.me/rowszeinsdelight');
  assert.equal(DEFAULT_CONTACT.email, 'hello@rowszeinsdelight.com');
  assert.deepEqual(shopContact({...loaded, email: '', phone: ''}),
    {messenger_url: loaded.messenger_url, facebook_url: loaded.facebook_url, email: '', phone: ''});
}]);
tests.push(['times read in 12-hour Manila style', () => {
  assert.equal(formatTime('00:00'), '12:00 AM');
  assert.equal(formatTime('09:00'), '9:00 AM');
  assert.equal(formatTime('12:30'), '12:30 PM');
  assert.equal(formatTime('15:00'), '3:00 PM');
}]);
tests.push(['hours group consecutive days with the same times', () => {
  assert.deepEqual(groupHours(week({0: day(0, null, null)})),
    [{days: 'Mon', time: 'Closed'}, {days: 'Tue–Sun', time: '9:00 AM–6:00 PM'}]);
  assert.deepEqual(groupHours(week({5: day(5, '10:00', '14:00')})),
    [{days: 'Mon–Fri', time: '9:00 AM–6:00 PM'}, {days: 'Sat', time: '10:00 AM–2:00 PM'}, {days: 'Sun', time: '9:00 AM–6:00 PM'}]);
  assert.deepEqual(groupHours(week()), [{days: 'Mon–Sun', time: '9:00 AM–6:00 PM'}]);
}]);
tests.push(['hidden hours are null; a fully closed week is empty', () => {
  assert.equal(groupHours([]), null);
  assert.deepEqual(groupHours(Array.from({length: 7}, (_, weekday) => day(weekday, null, null))), []);
}]);
tests.push(['the cutoff sentence covers each lead time', () => {
  const cases = [
    [[0, null], 'Order today for same-day delivery.'],
    [[0, '11:00'], 'Order by 11:00 AM for same-day delivery.'],
    [[1, null], 'Order a day ahead.'],
    [[1, '15:00'], 'Order by 3:00 PM for next-day delivery.'],
    [[3, null], 'Order 3 days ahead.'],
    [[3, '15:00'], 'Order by 3:00 PM, 3 days before delivery.'],
  ];
  for (const [[lead, cutoff], sentence] of cases) assert.equal(cutoffSentence(lead, cutoff), sentence);
}]);
tests.push(['fees: undecided, free, or an amount', () => {
  assert.equal(feeLabel(null), 'Fee confirmed when we reply');
  assert.equal(feeLabel('0.00'), 'Free delivery');
  assert.equal(feeLabel('50.00'), `${formatPeso(50)} delivery`);
}]);
tests.push(['days off read naturally across months and years', () => {
  assert.equal(dayOffLabel({starts: '2026-12-24', ends: '2026-12-26', note: 'Christmas break'}), 'Dec 24–26 · Christmas break');
  assert.equal(dayOffLabel({starts: '2026-11-30', ends: '2026-11-30', note: ''}), 'Nov 30');
  assert.equal(dayOffLabel({starts: '2026-12-30', ends: '2027-01-02', note: ''}), 'Dec 30 – Jan 2');
  assert.equal(dayOffLabel({starts: '2026-11-28', ends: '2026-12-01', note: 'Inventory'}), 'Nov 28 – Dec 1 · Inventory');
}]);
tests.push(['payment labels and the pause fallback', () => {
  assert.deepEqual(Object.values(PAYMENT_LABELS), ['GCash', 'Maya', 'Bank transfer', 'Cash on delivery']);
  assert.equal(DEFAULT_PAUSE_MESSAGE, "We're not taking orders right now. Message us on Messenger for anything urgent.");
}]);

for (const [name, test] of tests) { test(); console.log('PASS: ' + name); }
console.log(JSON.stringify({tests: tests.length, failures: 0, database_access: false}, null, 2));
