import assert from 'node:assert/strict';
import {
  allowedDeliveryDates, checkoutErrors, deliveryDayLabel, displayPhone, lastOrder, normalisePhone, orderPayload, rememberLastOrder,
} from '../../frontend/src/lib/orderCheckout.ts';

const week = (closed = []) => Array.from({length: 7}, (_, weekday) =>
  ({weekday, is_open: !closed.includes(weekday), opens: closed.includes(weekday) ? null : '09:00', closes: closed.includes(weekday) ? null : '18:00'}));
const settings = (changes = {}) => ({
  messenger_url: 'https://m.me/rowszeinsdelight', facebook_url: '', email: '', phone: '', notice: '', orders_paused: false,
  pause_message: '', lead_days: 1, order_cutoff: null, payment_methods: [], hours: [],
  towns: [{id: 1, name: 'Lucena City', fee: null}], days_off: [], ...changes,
});
// Monday 16 Nov 2026 in Manila (UTC+8).
const manila = (day, hour, minute = 0) => new Date(Date.UTC(2026, 10, day, hour - 8, minute));

const tests = [];
tests.push(['the earliest day is today plus the lead time, in Manila', () => {
  assert.equal(allowedDeliveryDates(settings(), manila(16, 10))[0], '2026-11-17');
  assert.equal(allowedDeliveryDates(settings({lead_days: 0}), manila(16, 10))[0], '2026-11-16');
}]);
tests.push(['after the cutoff the earliest day moves by one', () => {
  const s = settings({order_cutoff: '15:00'});
  assert.equal(allowedDeliveryDates(s, manila(16, 14, 59))[0], '2026-11-17');
  assert.equal(allowedDeliveryDates(s, manila(16, 15, 1))[0], '2026-11-18');
}]);
tests.push(['a phone set to another time zone still uses the Manila date', () => {
  // 23:30 UTC on Nov 16 is already 07:30 on Nov 17 in Manila.
  assert.equal(allowedDeliveryDates(settings(), new Date(Date.UTC(2026, 10, 16, 23, 30)))[0], '2026-11-18');
}]);
tests.push(['days off and closed weekdays are skipped; hidden hours allow every weekday', () => {
  const offs = settings({days_off: [{starts: '2026-11-18', ends: '2026-11-19', note: ''}]});
  assert.deepEqual(allowedDeliveryDates(offs, manila(16, 10), 3), ['2026-11-17', '2026-11-20', '2026-11-21']);
  const closedWednesday = settings({hours: week([2])});
  assert.deepEqual(allowedDeliveryDates(closedWednesday, manila(16, 10), 2), ['2026-11-17', '2026-11-19']);
  assert.deepEqual(allowedDeliveryDates(settings(), manila(16, 10), 3), ['2026-11-17', '2026-11-18', '2026-11-19']);
}]);
tests.push(['never more than thirty days past the earliest day', () => {
  const all = allowedDeliveryDates(settings(), manila(16, 10), 100);
  assert.equal(all.length, 31);
  assert.equal(all.at(-1), '2026-12-17');
}]);
tests.push(['delivery days read naturally', () => {
  assert.equal(deliveryDayLabel('2026-11-18'), 'Wed, Nov 18');
  assert.equal(deliveryDayLabel('2027-01-01'), 'Fri, Jan 1');
}]);
tests.push(['mobile numbers are normalised like the server does', () => {
  assert.equal(normalisePhone('0917 123 4567'), '+639171234567');
  assert.equal(normalisePhone('+63 917 123 4567'), '+639171234567');
  assert.equal(normalisePhone('639171234567'), '+639171234567');
  assert.equal(normalisePhone('12345'), null);
  assert.equal(normalisePhone(''), null);
}]);
tests.push(['stored numbers read the way people write them', () => {
  assert.equal(displayPhone('+639171234567'), '0917 123 4567');
  assert.equal(displayPhone('0917 123 4567'), '0917 123 4567');
  assert.equal(displayPhone(''), '');
}]);
tests.push(['the form explains each problem next to its field', () => {
  const form = {customer_name: '', phone: '123', town: '', address: '<b>', delivery_date: '2026-11-16', payment_method: '', note: 'x'.repeat(301)};
  const errors = checkoutErrors(form, settings({payment_methods: ['gcash']}), manila(16, 10));
  assert.deepEqual(errors, {
    customer_name: 'Enter your name.',
    phone: 'Enter a mobile number like 0917 123 4567.',
    town: 'Pick your town.',
    address: 'Leave out the < and > characters.',
    delivery_date: 'Pick a delivery day.',
    payment_method: "Pick how you'd like to pay.",
    note: 'Keep the note under 300 characters.',
  });
  const good = {customer_name: 'Ana Cruz', phone: '0917 123 4567', town: '1', address: '12 Rizal St', delivery_date: '2026-11-18', payment_method: '', note: ''};
  assert.deepEqual(checkoutErrors(good, settings(), manila(16, 10)), {});
}]);
tests.push(['the order sends products and boxes, never prices', () => {
  const cart = [{product_id: 3, name: 'Glazed', price: 35, image_url: null, quantity: 2}];
  const donut = (product_id) => ({product_id, name: 'x', image_url: null, box_extra: 0});
  const boxes = [
    {key: 'a', name: 'Box of 6', size: 6, boxPrice: 215, donuts: [donut(3), donut(3), donut(3), donut(5), donut(5), donut(5)]},
    {key: 'b', name: 'Classic six', size: 6, boxPrice: 200, donuts: [], assortmentId: 4},
  ];
  const form = {customer_name: ' Ana Cruz ', phone: '0917 123 4567', town: '1', address: '12 Rizal St', delivery_date: '2026-11-18', payment_method: 'cod', note: ''};
  const payload = orderPayload(cart, boxes, [{id: 9, size: 6}], form, 'key-12345678');
  assert.deepEqual(payload, {
    client_key: 'key-12345678', customer_name: 'Ana Cruz', phone: '0917 123 4567', address: '12 Rizal St', note: '',
    town: 1, delivery_date: '2026-11-18', payment_method: 'cod', website: '',
    items: [{product: 3, quantity: 2}],
    boxes: [{box_size: 9, contents: [{product: 3, quantity: 3}, {product: 5, quantity: 3}]}, {assortment: 4}],
  });
  assert.equal(JSON.stringify(payload).includes('price'), false);
}]);
tests.push(['the last order is remembered, and missing storage is harmless', () => {
  const store = new Map();
  globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)};
  rememberLastOrder({number: 'RD-261116-ABCD', token: 'tok'});
  assert.deepEqual(lastOrder(), {number: 'RD-261116-ABCD', token: 'tok'});
  globalThis.localStorage = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }};
  assert.equal(lastOrder(), null);
  rememberLastOrder({number: 'x', token: 'y'});
  delete globalThis.localStorage;
  assert.equal(lastOrder(), null);
}]);

for (const [name, test] of tests) { test(); console.log('PASS: ' + name); }
console.log(JSON.stringify({tests: tests.length, failures: 0, database_access: false}, null, 2));
