import assert from 'node:assert/strict';
import {
  DEFAULT_CONTACT, DEFAULT_PAUSE_MESSAGE, PAYMENT_LABELS,
  cutoffSentence, dayOffLabel, feeLabel, formatTime, groupHours, listNames, shopContact,
} from '../../frontend/src/lib/shopSettings.ts';
import {formatPeso} from '../../frontend/src/pages/dashboard/report-format.ts';
import {isDirty, toDraft, toPayload} from '../../frontend/src/pages/settings/draft.ts';

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
tests.push(['names read as an English list', () => {
  assert.equal(listNames(['Lucena City', 'Tayabas', 'Sariaya']), 'Lucena City, Tayabas and Sariaya');
  assert.equal(listNames(['Lucena City', 'Tayabas']), 'Lucena City and Tayabas');
  assert.equal(listNames(['Sariaya']), 'Sariaya');
  assert.equal(listNames([]), '');
}]);
tests.push(['payment labels and the pause fallback', () => {
  assert.deepEqual(Object.values(PAYMENT_LABELS), ['GCash', 'Maya', 'Bank transfer', 'Cash on delivery']);
  assert.equal(DEFAULT_PAUSE_MESSAGE, "We're not taking orders right now. Message us on Messenger for anything urgent.");
}]);

const managed = {
  ...loaded, order_email: 'owner@example.com', show_hours: true, revision: 4, updated_at: '2026-11-14T09:00:00+08:00', order_cutoff: '15:00',
  payment_methods: ['gcash', 'cod'], notice: 'No deliveries on Nov 30',
  hours: week({0: day(0, null, null)}),
  towns: [{id: 1, name: 'Lucena City', is_active: true, fee: '0.00'}, {id: 2, name: 'Tayabas', is_active: false, fee: null},
    {id: 3, name: 'Sariaya', is_active: true, fee: '50.00'}],
  days_off: [{starts: '2026-12-24', ends: '2026-12-26', note: 'Christmas break'}],
  meetup_places: [{id: 5, name: 'SM City Lucena, main entrance', note: 'Look for the pink box', is_active: true, hours: week({0: day(0, null, null)})}],
};
tests.push(['a loaded document round-trips through the form unchanged', () => {
  const {updated_at: _updated, ...payload} = managed;
  assert.deepEqual(toPayload(toDraft(managed)), payload);
}]);
tests.push(['blank fee and cutoff mean none; typed fees become money', () => {
  const draft = toDraft(managed);
  draft.towns[0].fee = '';
  draft.towns[2].fee = '0';
  draft.order_cutoff = '';
  draft.towns[1].name = '  Tayabas  ';
  const payload = toPayload(draft);
  assert.equal(payload.towns[0].fee, null);
  assert.equal(payload.towns[2].fee, '0.00');
  assert.equal(payload.order_cutoff, null);
  assert.equal(payload.towns[1].name, 'Tayabas');
  assert.equal(toPayload({...draft, towns: [{...draft.towns[0], fee: 'abc'}]}).towns[0].fee, 'abc');
}]);
tests.push(['new rows have no id; dirty tracks real changes only', () => {
  const draft = toDraft(managed);
  assert.equal(isDirty(draft, toDraft(managed)), false);
  const renamed = {...draft, towns: draft.towns.map((town, i) => i === 1 ? {...town, name: 'Tayabas City'} : town)};
  assert.equal(isDirty(renamed, draft), true);
  const added = {...draft, towns: [...draft.towns, {key: 'new', name: 'Pagbilao', is_active: true, fee: ''}]};
  assert.equal('id' in toPayload(added).towns[3], false);
  assert.notEqual(draft.towns[0].key, draft.towns[1].key);
}]);

for (const [name, test] of tests) { test(); console.log('PASS: ' + name); }
console.log(JSON.stringify({tests: tests.length, failures: 0, database_access: false}, null, 2));
