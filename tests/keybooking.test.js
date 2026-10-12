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

test('Key booking page: the key, the team to confirm, the slot, then a ticket with the same key', async () => {
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
  assert.ok(p.text().includes(w.keyA), 'the ticket shows the key the student already has');
  assert.equal(w.rows().length, 1);
  assert.equal(w.rows()[0].data.leader_code, '4230001');
});

test('Key booking page: a team that already booked is told so and cannot go on', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.type('#team-key', w.keyA); p.submitForm(); await settle();
  assert.ok(p.text().includes('already has a booking'));
  assert.equal(p.$('button[type="submit"]'), null, 'no button leads to a slot it cannot book');
  p.click('[name="other-key"]'); await settle();
  assert.equal(p.$('#team-key').value, '');
  p.type('#team-key', w.keyB); p.submitForm(); await settle();
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Next');
});

test('Key booking page: opening the booking with the key shows the copied details', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.clickText('Already registered'); await settle();
  p.type('#key-input', w.keyA); p.submitForm(); await settle();
  assert.ok(p.text().includes('Library System'));
  assert.ok(p.text().includes('Cancel registration'));
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
