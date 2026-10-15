const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../harness/appsscript-mock.js');
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

test(
  'Key booking setting: offered only with a form that issues keys, and ' +
    'saved with its form',
  async () => {
    const openAdmin = async (world, hash) => {
      const dom = await openPage('admin.html', world, { hash });
      dom.window.App.api.setPin('4321');
      await dom.window.App.admin.start();
      await settle(10);
      return { dom, ...helpers(dom.window) };
    };
    const w = boot({ keyBooking: { enabled: false } });
    const p = await openAdmin(w, `#/f/${w.form.slug}/settings`);
    assert.equal(
      p.$('[name="keySource"]'),
      null,
      'the form picker waits for the switch'
    );
    p.click('[name="keyBooking"]');
    assert.equal(p.$('[name="keySource"]').value, w.teams.id);
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: w.form.id }).form.keyBooking,
      { enabled: true, source: w.teams.id }
    );

    const lone = createWorld();
    lone.call('setup');
    lone.call('setAdminPin', '4321');
    lone.admin = (b) => lone.api({ ...b, admin: { pin: '4321' } });
    const only = lone.admin({
      action: 'admin.forms.create',
      type: 'reservation',
      title: 'Seminar',
      term: 'Fall 2027'
    }).form;
    const q = await openAdmin(lone, `#/f/${only.slug}/settings`);
    assert.equal(q.$('[name="keyBooking"]'), null);
    assert.ok(q.text().includes('No form gives its students a key yet'));
  }
);

test(
  'Booking series: the dashboard lists bookings under their form and ' +
    'makes the next one in one click',
  async () => {
    const w = boot();
    const openAdmin = async (world) => {
      const dom = await openPage('admin.html', world, { hash: '' });
      dom.window.App.api.setPin('4321');
      await dom.window.App.admin.start();
      await settle(10);
      return { win: dom.window, ...helpers(dom.window) };
    };
    const p = await openAdmin(w);
    assert.equal(
      p.$$('.card').length,
      1,
      'the booking is not a card of its own'
    );
    const card = p.$(`.card[data-slug="${w.teams.slug}"]`);
    const fold = card.querySelector('details.series');
    assert.equal(fold.open, false, 'the bookings are folded until asked for');
    assert.ok(
      fold.querySelector('.series-latest').textContent.includes(w.form.title),
      'the fold names the newest booking'
    );
    fold.open = true;
    p.fire(fold, 'toggle');
    assert.deepEqual(
      [...card.querySelectorAll('.series-title')].map((n) => n.textContent),
      [w.form.title]
    );
    p.click('[name="next-booking"]');
    await settle(12);
    assert.ok(
      p.win.location.hash.endsWith('/timetable'),
      'the new booking opens on its timetable'
    );
    assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 3);
    const again = await openAdmin(w);
    assert.equal(again.$$('.series-title').length, 2);
    assert.equal(again.$('.series-count').textContent, '2');
    const reopened = await openAdmin(w);
    assert.equal(
      reopened.$('details.series').open,
      false,
      'a new window starts folded'
    );
  }
);
