const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../harness/appsscript-mock.js');

const slot = (i) => ({
  day: 'sunday',
  time: ['12:30 - 12:50', '12:55 - 1:15'][i]
});
const member = (name, code) => ({
  name,
  code,
  phone: '01112345678',
  level: 'الثاني / الثالثة',
  curriculum: '2020',
  section: '4C-TH2'
});

/**
 * A team form with two registered teams and a reservation that is booked with
 * their keys.
 */
function boot(patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.teams = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Database Teams',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: w.teams.id,
    patch: { status: 'open' }
  });
  w.register = (code, extra = {}) =>
    w.api({
      action: 'submit',
      slug: w.teams.slug,
      data: {
        email: 'lead@example.com',
        leader_name: 'أحمد محمد محمود علي',
        leader_code: code,
        phone: '01012345678',
        major: 'حاسبات',
        level: 'الثاني / الثالثة',
        section: '4C-TH2',
        curriculum: '2020',
        team_size: '2',
        members: [member('سارة خالد حسن علي', String(Number(code) + 500))],
        title: 'Library System',
        ...extra
      }
    });
  w.keyA = w.register('4230001').key;
  w.keyB = w.register('4230002', { title: 'Clinic Booking' }).key;
  w.form = w.admin({
    action: 'admin.forms.create',
    type: 'reservation',
    title: 'Discussion',
    term: 'Fall 2027'
  }).form;
  w.update = (p) =>
    w.admin({ action: 'admin.forms.update', id: w.form.id, patch: p });
  w.update({
    status: 'open',
    slots: {
      days: [{ label: 'Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }],
      capacity: 1
    },
    keyBooking: { enabled: true, source: w.teams.id },
    ...patch
  });
  w.book = (key, s) =>
    w.api({
      action: 'submit',
      slug: w.form.slug,
      sourceKey: key,
      data: { slot: s }
    });
  w.rows = () =>
    w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  return w;
}

/* ── Pages ────────────────────────────────────────────────────── */

const { openPage, helpers, settle } = require('../harness/dom.js');

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
  assert.equal(
    p.$('[name="leader_name"]'),
    null,
    'no personal questions are asked'
  );
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Find my team');

  p.submitForm();
  await settle();
  assert.ok(
    p.text().includes('That key is not right'),
    'an empty key is refused in place'
  );
  p.type('#team-key', '00000');
  p.submitForm();
  await settle();
  assert.ok(p.text().includes('That key is not right'));
  assert.equal(
    p.$('#team-key').value,
    '00000',
    'the refused key stays in its field'
  );

  p.type('#team-key', w.keyA);
  p.submitForm();
  await settle();
  assert.ok(p.text().includes('This is your team'));
  assert.ok(p.text().includes('Library System'));
  assert.ok(p.text().includes('2 people'));
  assert.ok(
    p.text().includes('سارة خالد حسن علي'),
    'the teammates are named so the team can check them'
  );
  assert.equal(
    p.text().includes('01012345678'),
    false,
    'no phone number is shown'
  );
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Next');

  p.submitForm();
  await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot');
  p.submitForm();
  await settle();
  assert.equal(
    p.$('.step-title').textContent,
    'Time slot',
    'the slot is still required'
  );
  assert.ok(p.$('.field.has-error'));
  p.clickText('Sunday');
  await settle();
  p.click(p.$('.slot-chip.time'));
  await settle();
  p.submitForm();
  await settle();
  assert.ok(p.text().includes('Check your details'));
  assert.ok(p.text().includes('أحمد محمد محمود علي'));
  p.submitForm();
  await settle(12);
  assert.ok(
    p.$('#ticket [name="when"]'),
    'the ticket draws the day and the time'
  );
  assert.ok(p.$('#ticket [name="when"]').textContent.includes(slot(0).time));
  assert.equal(
    p.$$('.key-digit').length,
    0,
    'the key the team already has is not shown again'
  );
  assert.ok(p.$('[name="team-key-note"]'));
  assert.equal(w.rows().length, 1);
  assert.equal(w.rows()[0].data.leader_code, '4230001');
});

test('Key booking page: a team that already booked is told its time and changes it from there', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.type('#team-key', w.keyA);
  p.submitForm();
  await settle();
  assert.ok(
    p.$('[name="team-booked"]').textContent.includes('Sunday - 12:30 - 12:50')
  );
  assert.equal(
    p.$('button[type="submit"]'),
    null,
    'no button leads to a second booking'
  );
  assert.equal(
    p.$('[name="open-booking"]').textContent.trim(),
    'Change the time'
  );

  p.click('[name="open-booking"]');
  await settle();
  assert.equal(
    p.$('.step-title').textContent,
    'Time slot',
    'the booking opens on its time'
  );
  assert.equal(
    p.$('[name="slot-move"]'),
    null,
    'nothing is given up before another time is picked'
  );
  p.click(p.$$('.slot-chip.time')[1]);
  await settle();
  assert.ok(
    p.$('[name="slot-move"]').textContent.includes('12:30 - 12:50'),
    'the time given up is named'
  );
  p.submitForm();
  await settle();
  assert.equal(
    p.$$('.review-group .link-btn').length,
    1,
    'only the time can be changed'
  );
  p.submitForm();
  await settle(12);
  assert.equal(w.rows()[0].data.slot.time, slot(1).time);
  assert.ok(p.$('#ticket [name="when"]').textContent.includes(slot(1).time));
});

test('Key booking page: another key can be tried after a booked team', async () => {
  const w = boot({
    editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: false }
  });
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  p.type('#team-key', w.keyA);
  p.submitForm();
  await settle();
  assert.equal(
    p.$('[name="open-booking"]').textContent.trim(),
    'Open my registration',
    'a booking that cannot move is only opened'
  );
  p.click('[name="other-key"]');
  await settle();
  assert.equal(p.$('#team-key').value, '');
  p.type('#team-key', w.keyB);
  p.submitForm();
  await settle();
  assert.equal(p.$('button[type="submit"]').textContent.trim(), 'Next');
});

test('Key booking page: one key box, and the key that finds a booked team opens its booking', async () => {
  const w = boot();
  w.book(w.keyA, slot(0));
  const p = await openForm(w);
  assert.equal(p.$$('.key-input').length, 1);
  assert.ok(
    !p.text().includes('Already registered'),
    'no second place to type a key'
  );
  p.type('#team-key', w.keyA);
  p.submitForm();
  await settle();
  p.click('[name="open-booking"]');
  await settle();
  assert.equal(
    p.$('.step-title').textContent,
    'Time slot',
    'the booking opens without typing the key again'
  );
  p.submitForm();
  await settle();
  assert.ok(p.text().includes('Library System'));
  assert.ok(p.text().includes('Cancel registration'));

  p.click('[name="close-edit"]');
  await settle();
  assert.ok(
    p.$('#team-key'),
    'Close leaves the booking and returns to the first step'
  );
  assert.equal(p.$('#team-key').value, '');
});
