const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

function boot(slotsPatch, formPatch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Seminar Booking', term: 'Fall 2027' }).form;
  const slots = slotsPatch || {
    days: [
      { label: 'Week 11 - Sunday', date: '2027-11-14', times: w.ctx.Rules.generateSlots({ start: '12:30', end: '14:00', length: 20, gap: 5 }) },
      { label: 'Week 11 - Tuesday', date: '2027-11-16', times: ['12:30 - 12:50', '12:55 - 1:15'] }
    ],
    capacity: 1
  };
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open', slots, ...formPatch } });
  w.form = form;
  w.book = (code, slot, extra = {}) => w.api({
    action: 'submit', slug: form.slug,
    data: {
      email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: code, phone: '01012345678', major: 'حاسبات',
      level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Library System', slot, ...extra
    }
  });
  return w;
}

const sun = (i) => ({ day: 'week-11-sunday', time: ['12:30 - 12:50', '12:55 - 1:15', '1:20 - 1:40'][i] });

test('Slots: configuration is cleaned and gets stable day ids', () => {
  const w = boot({ days: [{ label: 'Week 11 - Sunday', times: ['1:00 - 1:10', ' 1:00 - 1:10 ', '1:15 - 1:25'] }, { label: 'Week 11 - Sunday', times: ['2:00 - 2:10'] }], capacity: 0 });
  const f = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  assert.deepEqual(f.slots.days.map((d) => d.id), ['week-11-sunday', 'week-11-sunday-2']);
  assert.deepEqual(f.slots.days[0].times, ['1:00 - 1:10', '1:15 - 1:25']);
  assert.equal(f.slots.capacity, 1);
});

test('Slots: bad configuration is rejected with a clear message', () => {
  const w = boot();
  const patch = (slots) => w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { slots } });
  assert.equal(patch({ days: [{ label: '', times: ['1:00 - 1:10'] }] }).error.code, 'bad_slots');
  assert.equal(patch({ days: [{ label: 'D', times: [] }] }).error.code, 'bad_slots');
  assert.equal(patch({ days: [{ label: 'D', date: '14/11/2027', times: ['1:00 - 1:10'] }] }).error.code, 'bad_slots');
});

test('Availability: public form reports counts only, never names', () => {
  const w = boot();
  assert.deepEqual(w.api({ action: 'getForm', slug: w.form.slug }).taken, {});
  w.book('4230001', sun(0));
  const res = w.api({ action: 'getForm', slug: w.form.slug });
  assert.deepEqual(res.taken, { 'week-11-sunday|12:30 - 12:50': 1 });
  assert.equal(JSON.stringify(res).includes('4230001'), false);
});

test('Booking: a slot can be taken once, then it is refused', () => {
  const w = boot();
  assert.equal(w.book('4230001', sun(0)).ok, true);
  const second = w.book('4230002', sun(0));
  assert.equal(second.error.code, 'slot_taken');
  assert.equal(w.book('4230002', sun(1)).ok, true);
});

test('Booking: the same leader cannot hold two slots', () => {
  const w = boot();
  w.book('4230001', sun(0));
  assert.equal(w.book('4230001', sun(1)).error.code, 'duplicate');
});

test('Booking: a slot that is not on the timetable is refused', () => {
  const w = boot();
  const r = w.book('4230001', { day: 'week-11-sunday', time: '9:00 - 9:20' });
  assert.equal(r.error.code, 'invalid');
  assert.equal(r.error.details.slot.error, 'invalid_slot');
  assert.equal(w.book('4230001', undefined).error.details.slot.error, 'required');
});

test('Booking: capacity above one allows that many teams per slot', () => {
  const w = boot({ days: [{ label: 'Lab day', times: ['1:00 - 1:10'] }], capacity: 2 });
  const s = { day: 'lab-day', time: '1:00 - 1:10' };
  assert.equal(w.book('4230001', s).ok, true);
  assert.equal(w.book('4230002', s).ok, true);
  assert.equal(w.book('4230003', s).error.code, 'slot_taken');
});

test('Booking: cancelling with the key frees the slot for someone else', () => {
  const w = boot();
  const a = w.book('4230001', sun(0));
  assert.equal(w.book('4230002', sun(0)).error.code, 'slot_taken');
  assert.equal(w.api({ action: 'remove', slug: w.form.slug, key: a.key }).removed, true);
  assert.deepEqual(w.api({ action: 'getForm', slug: w.form.slug }).taken, {});
  assert.equal(w.book('4230002', sun(0)).ok, true);
});

test('Booking: editing is off by default for reservations, like the old seminar form', () => {
  const w = boot();
  const a = w.book('4230001', sun(0));
  const r = w.api({ action: 'update', slug: w.form.slug, key: a.key, data: {} });
  assert.equal(r.error.code, 'edit_disabled');
});

test('Booking: when editing is allowed, moving frees the old slot and respects taken ones', () => {
  const w = boot(null, { editKey: { enabled: true, days: 7, allowEdit: true, allowDelete: true } });
  const a = w.book('4230001', sun(0));
  w.book('4230002', sun(1));
  const data = (slot) => ({
    email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
    level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Library System', slot
  });
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: a.key, data: data(sun(1)) }).error.code, 'slot_taken');
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: a.key, data: data(sun(2)) }).ok, true);
  const taken = w.api({ action: 'getForm', slug: w.form.slug }).taken;
  assert.equal(taken['week-11-sunday|12:30 - 12:50'], undefined);
  assert.equal(taken['week-11-sunday|1:20 - 1:40'], 1);
});

test('Slots: removing a booked slot warns about orphaned bookings', () => {
  const w = boot();
  w.book('4230001', sun(0));
  const r = w.admin({
    action: 'admin.forms.update', id: w.form.id,
    patch: { slots: { days: [{ label: 'Week 11 - Sunday', times: ['12:55 - 1:15'] }], capacity: 1 } }
  });
  assert.equal(r.orphanedBookings, 1);
});
