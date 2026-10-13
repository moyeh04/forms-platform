const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const slot = (i) => ({ day: 'sunday', time: ['12:30 - 12:50', '12:55 - 1:15'][i] });
const member = (name, code) => ({ name, code, phone: '01112345678', level: 'الثاني / الثالثة', curriculum: '2020', section: '4C-TH2' });

/** A team form with two registered teams and a reservation that is booked with their keys. */
function boot(patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.teams = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Database Teams', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: w.teams.id, patch: { status: 'open' } });
  w.register = (code, extra = {}) => w.api({
    action: 'submit', slug: w.teams.slug,
    data: {
      email: 'lead@example.com', leader_name: 'أحمد محمد محمود علي', leader_code: code, phone: '01012345678', major: 'حاسبات',
      level: 'الثاني / الثالثة', section: '4C-TH2', curriculum: '2020', team_size: '2',
      members: [member('سارة خالد حسن علي', String(Number(code) + 500))], title: 'Library System', ...extra
    }
  });
  w.keyA = w.register('4230001').key;
  w.keyB = w.register('4230002', { title: 'Clinic Booking' }).key;
  w.form = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Discussion', term: 'Fall 2027' }).form;
  w.update = (p) => w.admin({ action: 'admin.forms.update', id: w.form.id, patch: p });
  w.update({
    status: 'open', slots: { days: [{ label: 'Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }], capacity: 1 },
    keyBooking: { enabled: true, source: w.teams.id }, ...patch
  });
  w.book = (key, s) => w.api({ action: 'submit', slug: w.form.slug, sourceKey: key, data: { slot: s } });
  w.rows = () => w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  return w;
}

test('Key booking: the setting needs a form that issues keys, and only a reservation takes it', () => {
  const w = boot();
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: w.form.id }).keySources.map((s) => s.title), ['Database Teams']);
  assert.equal(w.update({ keyBooking: { enabled: true, source: 'nope' } }).error.code, 'bad_key_booking');
  assert.equal(w.update({ keyBooking: { enabled: true, source: w.form.id } }).error.code, 'bad_key_booking');
  assert.equal(w.admin({ action: 'admin.forms.update', id: w.teams.id, patch: { keyBooking: { enabled: true, source: w.form.id } } }).error.code, 'bad_key_booking');
  assert.equal(w.update({ keyBooking: { enabled: false } }).ok, true);
  assert.equal(w.api({ action: 'getForm', slug: w.form.slug }).form.keyBooking, undefined);
});

test('Key booking: the public form names the registration form and nothing else about it', () => {
  const w = boot();
  const pub = w.api({ action: 'getForm', slug: w.form.slug }).form;
  assert.deepEqual(pub.keyBooking, { title: 'Database Teams' });
});

test('Key booking: a key shows the team to confirm, without contact details', () => {
  const w = boot();
  const res = w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA });
  assert.deepEqual(res.team, { ref: res.team.ref, leader: 'أحمد محمد محمود علي', code: '4230001', title: 'Library System', size: 2 });
  assert.equal(res.booked, false);
  assert.equal(JSON.stringify(res).includes('0101'), false);
  assert.equal(JSON.stringify(res).includes('example.com'), false);
  assert.equal(w.api({ action: 'bookingTeam', slug: w.form.slug, key: '00000' }).error.code, 'bad_key');
});

test('Key booking: the booking carries the registration answers and only the slot is sent', () => {
  const w = boot();
  const res = w.book(w.keyA, slot(0));
  assert.equal(res.ok, true);
  const row = w.rows()[0];
  assert.equal(row.data.leader_name, 'أحمد محمد محمود علي');
  assert.equal(row.data.leader_code, '4230001');
  assert.equal(row.data.title, 'Library System');
  assert.equal(row.data.section, '4C-TH2');
  assert.deepEqual(row.data.slot, slot(0));
  assert.equal(row.data._source.form, w.teams.id);
  assert.equal(row.slot, 'sunday|12:30 - 12:50');
  assert.deepEqual(row.data.members || [], [], 'teammates stay out while the form does not ask for them');
});

test('Key booking: teammates are copied when the reservation asks for them', () => {
  const w = boot();
  const form = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  form.fields.filter((f) => f.role === 'members')[0].enabled = true;
  w.update({ fields: form.fields });
  assert.equal(w.book(w.keyA, slot(0)).ok, true);
  assert.deepEqual(w.rows()[0].data.members.map((m) => m.code), ['4230501']);
});

test('Key booking: answers typed by hand are ignored, a wrong key and a bad slot are refused', () => {
  const w = boot();
  const forged = w.api({ action: 'submit', slug: w.form.slug, sourceKey: w.keyA, data: { slot: slot(0), leader_name: 'شخص آخر تماما هنا', leader_code: '9999999' } });
  assert.equal(forged.ok, true);
  assert.equal(w.rows()[0].data.leader_code, '4230001');
  assert.equal(w.api({ action: 'submit', slug: w.form.slug, data: { slot: slot(1) } }).error.code, 'bad_key');
  assert.equal(w.book('00000', slot(1)).error.code, 'bad_key');
  assert.equal(w.book(w.keyB, { day: 'sunday', time: '9:00 - 9:10' }).error.code, 'invalid');
  assert.equal(w.book(w.keyB, slot(0)).error.code, 'slot_taken');
});

test('Key booking: one booking per team, opened and cancelled by the same key', () => {
  const w = boot();
  const first = w.book(w.keyA, slot(0));
  assert.equal(first.key, w.keyA, 'the booking answers to the registration key');
  assert.equal(w.book(w.keyA, slot(1)).error.code, 'already_booked');
  assert.equal(w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).booked, true);
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: w.keyA }).submission.data.title, 'Library System');
  assert.equal(w.api({ action: 'remove', slug: w.form.slug, key: w.keyA }).removed, true);
  assert.equal(w.book(w.keyA, slot(1)).ok, true, 'a cancelled team can book again');
});

test('Key booking: with editing on, a booking can move to another slot and nothing else changes', () => {
  const w = boot({ editKey: { enabled: true, days: 7, allowEdit: true, allowDelete: true } });
  assert.equal(w.book(w.keyA, slot(0)).ok, true);
  const before = w.rows()[0];
  const moved = w.api({
    action: 'update', slug: w.form.slug, key: w.keyA,
    data: { slot: slot(1), leader_name: 'شخص اخر تماما هنا', leader_code: '9999999', title: 'Not Their Project' }
  });
  assert.equal(moved.ok, true);
  const after = w.rows()[0];
  assert.deepEqual([after.name, after.code, after.title], [before.name, before.code, before.title], 'the team is still the one the key belongs to');
  assert.equal(after.data.slot.time, slot(1).time);
  assert.deepEqual(after.data._source, before.data._source);
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: w.keyA, data: { slot: { day: 'sunday', time: 'never' } } }).error.code, 'invalid');
  assert.equal(w.book(w.keyB, slot(1)).error.code, 'slot_taken', 'the slot it moved to is taken');
  assert.equal(w.book(w.keyB, slot(0)).ok, true, 'and the slot it left is free');
});

test('Key booking: a team that may cancel its booking may move it, and the key that finds the team says its time', () => {
  const w = boot();
  assert.equal(w.book(w.keyA, slot(0)).ok, true);
  const team = w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA });
  assert.deepEqual([team.booked, team.slot.time, team.canMove], [true, slot(0).time, true]);
  assert.equal(w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyB }).slot, undefined, 'a team with no booking has no time');
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: w.keyA }).slotOnly, true);
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: w.keyA, data: { slot: slot(1) } }).ok, true);
  assert.equal(w.rows()[0].data.slot.time, slot(1).time);

  w.update({ editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: false } });
  assert.equal(w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).canMove, false);
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: w.keyA, data: { slot: slot(0) } }).error.code, 'edit_disabled');
});

test('Key booking: a key that expired for editing still books', () => {
  const w = boot();
  w.advanceDays(9);
  assert.equal(w.api({ action: 'lookup', slug: w.teams.slug, key: w.keyA }).error.code, 'key_expired');
  assert.equal(w.book(w.keyA, slot(0)).ok, true);
});

test('Key booking: switched off, the form is filled in by hand again', () => {
  const w = boot();
  w.update({ keyBooking: { enabled: false } });
  assert.equal(w.book(w.keyA, slot(0)).error.code, 'invalid');
  assert.equal(w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).error.code, 'key_booking_off');
});

/* ── Pages ────────────────────────────────────────────────────── */

const { openPage, helpers, settle } = require('./harness/dom.js');

async function openForm(w) {
  const dom = await openPage('index.html', w, { query: `?f=${w.form.slug}` });
  dom.window.App.form.init();
  await settle();
  return { dom, win: dom.window, ...helpers(dom.window) };
}

test('Key booking page: the key, the team to confirm, the slot, then a ticket with the time instead of the key', async () => {
  const w = boot();
  const p = await openForm(w);
  assert.equal(p.$('.step-title').textContent, 'Your team');
  assert.ok(p.text().includes('registered in "Database Teams"'));
  assert.equal(p.$('[name="leader_name"]'), null, 'no personal questions are asked');
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Find my team');

  p.submitForm(); await settle();
  assert.ok(p.text().includes('That key is not right'), 'an empty key is refused in place');
  p.type('#team-key', '00000'); p.submitForm(); await settle();
  assert.ok(p.text().includes('That key is not right'));
  assert.equal(p.$('#team-key').value, '00000', 'the refused key stays in its field');

  p.type('#team-key', w.keyA); p.submitForm(); await settle();
  assert.ok(p.text().includes('This is your team'));
  assert.ok(p.text().includes('Library System'));
  assert.ok(p.text().includes('2 people'));
  assert.equal(p.text().includes('01012345678'), false, 'no phone number is shown');
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Next');

  p.submitForm(); await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot');
  p.submitForm(); await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot', 'the slot is still required');
  assert.ok(p.$('.field.has-error'));
  p.clickText('Sunday'); await settle();
  p.click(p.$('.slot-chip.time')); await settle();
  p.submitForm(); await settle();
  assert.ok(p.text().includes('Check your details'));
  assert.ok(p.text().includes('أحمد محمد محمود علي'));
  p.submitForm(); await settle(12);
  assert.ok(p.$('#ticket [name="when"]'), 'the ticket draws the day and the time');
  assert.ok(p.$('#ticket [name="when"]').textContent.includes(slot(0).time));
  assert.equal(p.$$('.key-digit').length, 0, 'the key the team already has is not shown again');
  assert.ok(p.$('[name="team-key-note"]'));
  assert.equal(w.rows().length, 1);
  assert.equal(w.rows()[0].data.leader_code, '4230001');
});

test('Key booking page: a team that already booked is told its time and changes it from there', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.type('#team-key', w.keyA); p.submitForm(); await settle();
  assert.ok(p.$('[name="team-booked"]').textContent.includes('Sunday - 12:30 - 12:50'));
  assert.equal(p.$('button[type="submit"]'), null, 'no button leads to a second booking');
  assert.equal(p.$('[name="open-booking"]').textContent.trim(), 'Change the time');

  p.click('[name="open-booking"]'); await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot', 'the booking opens on its time');
  assert.equal(p.$('[name="slot-move"]'), null, 'nothing is given up before another time is picked');
  p.click(p.$$('.slot-chip.time')[1]); await settle();
  assert.ok(p.$('[name="slot-move"]').textContent.includes('12:30 - 12:50'), 'the time given up is named');
  p.submitForm(); await settle();
  assert.equal(p.$$('.review-group .link-btn').length, 1, 'only the time can be changed');
  p.submitForm(); await settle(12);
  assert.equal(w.rows()[0].data.slot.time, slot(1).time);
  assert.ok(p.$('#ticket [name="when"]').textContent.includes(slot(1).time));
});

test('Key booking page: another key can be tried after a booked team', async () => {
  const w = boot({ editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: false } });
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.type('#team-key', w.keyA); p.submitForm(); await settle();
  assert.equal(p.$('[name="open-booking"]').textContent.trim(), 'Open my registration', 'a booking that cannot move is only opened');
  p.click('[name="other-key"]'); await settle();
  assert.equal(p.$('#team-key').value, '');
  p.type('#team-key', w.keyB); p.submitForm(); await settle();
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Next');
});

test('Key booking page: one key box, and the key that finds a booked team opens its booking', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  assert.equal(p.$$('.key-input').length, 1);
  assert.ok(!p.text().includes('Already registered'), 'no second place to type a key');
  p.type('#team-key', w.keyA); p.submitForm(); await settle();
  p.click('[name="open-booking"]'); await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot', 'the booking opens without typing the key again');
  p.submitForm(); await settle();
  assert.ok(p.text().includes('Library System'));
  assert.ok(p.text().includes('Cancel registration'));

  p.click('[name="close-edit"]'); await settle();
  assert.ok(p.$('#team-key'), 'Close leaves the booking and returns to the first step');
  assert.equal(p.$('#team-key').value, '');
});

test('Key booking setting: offered only with a form that issues keys, and saved with its form', async () => {
  const openAdmin = async (world, hash) => {
    const dom = await openPage('admin.html', world, { hash });
    dom.window.App.api.setPin('4321');
    await dom.window.App.admin.start();
    await settle(10);
    return { dom, ...helpers(dom.window) };
  };
  const w = boot({ keyBooking: { enabled: false } });
  const p = await openAdmin(w, `#/f/${w.form.slug}/settings`);
  assert.equal(p.$('[name="keySource"]'), null, 'the form picker waits for the switch');
  p.click('[name="keyBooking"]');
  assert.equal(p.$('[name="keySource"]').value, w.teams.id);
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: w.form.id }).form.keyBooking, { enabled: true, source: w.teams.id });

  const lone = createWorld();
  lone.call('setup'); lone.call('setAdminPin', '4321');
  lone.admin = (b) => lone.api({ ...b, admin: { pin: '4321' } });
  const only = lone.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Seminar', term: 'Fall 2027' }).form;
  const q = await openAdmin(lone, `#/f/${only.slug}/settings`);
  assert.equal(q.$('[name="keyBooking"]'), null);
  assert.ok(q.text().includes('No form gives its students a key yet'));
});

test('Booking series: the first booking is made for a form, and each next one is the last one a week later', () => {
  const w = boot();
  const next = (extra = {}) => w.admin({ action: 'admin.bookings.next', source: w.teams.id, ...extra });
  const dated = { status: 'open', slots: { days: [{ label: 'Sunday 14 Nov', date: '2027-11-14', times: ['12:30 - 12:50', '12:55 - 1:15'] }, { label: 'Week 11 - Tuesday', date: '2027-11-16', times: ['12:30 - 12:50'] }, { label: 'Any day', times: ['2:00 - 2:20'] }], capacity: 2 } };
  w.update(dated);
  assert.equal(w.book(w.keyA, { day: 'sunday-14-nov', time: '12:30 - 12:50' }).ok, true);

  const second = next();
  assert.equal(second.copied, true);
  assert.equal(second.form.title, w.form.title + ' 2', 'a title with no number gets one');
  assert.equal(second.form.status, 'draft');
  assert.notEqual(second.form.sheetId, w.form.sheetId, 'the copy has its own sheet');
  assert.deepEqual(JSON.parse(JSON.stringify(second.form.keyBooking)), { enabled: true, source: w.teams.id });
  assert.deepEqual(second.form.slots.days.map((d) => [d.label, d.date]), [['Sunday 21 Nov', '2027-11-21'], ['Week 12 - Tuesday', '2027-11-23'], ['Any day', '']]);
  assert.equal(second.form.slots.capacity, 2);
  assert.equal(w.admin({ action: 'admin.submissions', slug: second.form.slug }).submissions.length, 0, 'bookings are not copied');

  w.admin({ action: 'admin.forms.update', id: second.form.id, patch: { title: 'Discussion - Week 2' } });
  assert.equal(next().form.title, 'Discussion - Week 3', 'the number in the title goes up');
  assert.equal(next({ title: 'Final discussion' }).form.title, 'Final discussion');

  assert.equal(next({ source: w.form.id }).error.code, 'bad_key_booking', 'a reservation has no keys of its own to book with');
});

test('Booking series: the dashboard lists bookings under their form and makes the next one in one click', async () => {
  const w = boot();
  const openAdmin = async (world) => {
    const dom = await openPage('admin.html', world, { hash: '' });
    dom.window.App.api.setPin('4321');
    await dom.window.App.admin.start(); await settle(10);
    return { win: dom.window, ...helpers(dom.window) };
  };
  const p = await openAdmin(w);
  assert.equal(p.$$('.card').length, 1, 'the booking is not a card of its own');
  const card = p.$(`.card[data-slug="${w.teams.slug}"]`);
  const fold = card.querySelector('details.series');
  assert.equal(fold.open, false, 'the bookings are folded until asked for');
  assert.ok(fold.querySelector('.series-latest').textContent.includes(w.form.title), 'the fold names the newest booking');
  fold.open = true; p.fire(fold, 'toggle');
  assert.deepEqual([...card.querySelectorAll('.series-title')].map((n) => n.textContent), [w.form.title]);
  p.click('[name="next-booking"]'); await settle(12);
  assert.ok(p.win.location.hash.endsWith('/timetable'), 'the new booking opens on its timetable');
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 3);
  const again = await openAdmin(w);
  assert.equal(again.$$('.series-title').length, 2);
  assert.equal(again.$('.series-count').textContent, '2');
  const reopened = await openAdmin(w);
  assert.equal(reopened.$('details.series').open, false, 'a new window starts folded');
});
