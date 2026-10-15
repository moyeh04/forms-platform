const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const DAY = 86400000;

/** A team form with three registrations: one from ten days ago, whose 7-day key has expired. */
function boot() {
  const w = createWorld({ now: Date.parse('2027-09-01T10:00:00Z') });
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Database Team Project',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open' }
  });
  w.form = form;
  const team = (code, title) => ({
    email: 'a@b.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: code,
    phone: '01012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    team_size: '1',
    members: [],
    title
  });
  w.made = [
    ['4230001', 'Old'],
    ['4230002', 'Library'],
    ['4230003', 'Clinic']
  ].map(([code, title], i) => {
    if (i === 1) w.setNow('2027-09-11T10:00:00Z');
    return w.api({
      action: 'submit',
      slug: form.slug,
      data: team(code, title)
    });
  });
  w.keys = () => w.admin({ action: 'admin.keys.list', slug: form.slug }).keys;
  w.extend = (b) =>
    w.admin({ action: 'admin.keys.extend', slug: form.slug, ...b });
  w.open = (i) =>
    w.api({ action: 'lookup', slug: form.slug, key: w.made[i].key });
  return w;
}

test('Keys: the list says which keys are given and which expired', () => {
  const w = boot();
  const keys = w.keys();
  assert.deepEqual(
    keys.map((k) => [k.ref, k.title, k.expired]),
    [
      ['TR-2027-0001', 'Old', true],
      ['TR-2027-0002', 'Library', false],
      ['TR-2027-0003', 'Clinic', false]
    ]
  );
  assert.equal(w.open(0).error.code, 'key_expired');
});

test('Keys: extending the expired ones counts from today, so they work for the whole period', () => {
  const w = boot();
  const before = w.keys();
  const r = w.extend({ which: 'expired', days: 7 });
  assert.equal(r.changed, 1);
  const after = r.keys;
  assert.equal(
    after[0].keyExpires,
    new Date(Date.parse('2027-09-11T10:00:00Z') + 7 * DAY).toISOString(),
    'from today, not from its old end'
  );
  assert.equal(
    after[1].keyExpires,
    before[1].keyExpires,
    'working keys are left alone'
  );
  assert.equal(w.open(0).ok, true, 'the key works again');
});

test('Keys: extending all of them adds time to each end, and a date sets one end for all', () => {
  const w = boot();
  const before = w.keys();
  w.extend({ which: 'all', days: 3 });
  const after = w.keys();
  assert.equal(
    after[1].keyExpires,
    new Date(Date.parse(before[1].keyExpires) + 3 * DAY).toISOString(),
    'from the later end date'
  );
  w.extend({ which: 'all', until: '2027-12-31T21:59:00Z' });
  assert.deepEqual(
    [...new Set(w.keys().map((k) => k.keyExpires))],
    ['2027-12-31T21:59:00.000Z']
  );
});

test('Keys: only the chosen teams change', () => {
  const w = boot();
  const before = w.keys();
  const r = w.extend({ which: 'chosen', ids: [before[2].id], days: 14 });
  assert.equal(r.changed, 1);
  assert.notEqual(r.keys[2].keyExpires, before[2].keyExpires);
  assert.equal(r.keys[0].keyExpires, before[0].keyExpires);
  assert.equal(r.keys[1].keyExpires, before[1].keyExpires);
});

test('Keys: bad requests change nothing', () => {
  const w = boot();
  const before = JSON.stringify(w.keys());
  assert.equal(
    w.extend({ which: 'chosen', ids: [], days: 7 }).error.code,
    'none_chosen'
  );
  assert.equal(
    w.extend({ which: 'chosen', ids: ['nope'], days: 7 }).error.code,
    'submission_not_found'
  );
  assert.equal(w.extend({ which: 'all', days: 0 }).error.code, 'bad_days');
  assert.equal(w.extend({ which: 'all', days: 400 }).error.code, 'bad_days');
  assert.equal(
    w.extend({ which: 'all', until: '2027-09-01T00:00:00Z' }).error.code,
    'bad_date',
    'a date in the past'
  );
  assert.equal(
    w.api({
      action: 'admin.keys.extend',
      slug: w.form.slug,
      which: 'all',
      days: 7
    }).error.code,
    'bad_pin'
  );
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: {
      editKey: { enabled: false, days: 7, allowEdit: true, allowDelete: true }
    }
  });
  assert.equal(w.extend({ which: 'all', days: 7 }).error.code, 'key_disabled');
  assert.equal(JSON.stringify(w.keys()), before);
});

test('Keys: a cancelled registration has no key to extend', () => {
  const w = boot();
  w.api({ action: 'remove', slug: w.form.slug, key: w.made[2].key });
  assert.deepEqual(
    w.keys().map((k) => k.ref),
    ['TR-2027-0001', 'TR-2027-0002']
  );
});
