const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  w.make = (title, type) =>
    w.admin({
      action: 'admin.forms.create',
      type: type || 'task_submission',
      title,
      term: 'Fall 2027'
    }).form;
  w.forms = () => w.admin({ action: 'admin.forms.list' }).forms;
  return w;
}

test('Registry: every change to forms, lists and private links is written inside the lock', () => {
  const w = boot();
  w.watchLocks = true;
  const a = w.make('Alpha', 'team_registration');
  const b = w.make('Beta');
  w.admin({
    action: 'admin.forms.update',
    id: a.id,
    patch: { title: 'Alpha two', status: 'open' }
  });
  w.admin({ action: 'admin.forms.duplicate', id: a.id, title: 'Alpha copy' });
  w.admin({
    action: 'admin.bookings.next',
    source: a.id,
    title: 'Discussion - Week 1'
  });
  w.admin({ action: 'admin.bookings.next', source: a.id });
  const made = w.admin({
    action: 'admin.lists.create',
    name: 'Labs',
    kind: 'plain'
  });
  w.admin({ action: 'admin.lists.set', key: made.key, values: ['L1', 'L2'] });
  w.admin({ action: 'admin.lists.rename', key: made.key, name: 'Lab rooms' });
  w.admin({ action: 'admin.lists.delete', key: made.key });
  const c = w.admin({
    action: 'admin.clients.create',
    name: 'Dr. Example',
    forms: [a.id]
  }).client;
  w.admin({
    action: 'admin.clients.update',
    id: c.id,
    patch: { name: 'Dr. Sample', canReview: true }
  });
  w.admin({ action: 'admin.clients.regenerate', id: c.id });
  w.admin({ action: 'admin.clients.key', id: c.id });
  w.admin({ action: 'admin.forms.delete', id: b.id, confirm: b.slug });
  w.admin({ action: 'admin.clients.remove', id: c.id });
  assert.deepEqual(w.unlockedWrites, []);
  assert.equal(w.lock.held, false, 'the lock is released after each request');
});

test('Registry: a form saved while another is deleted keeps its own row', () => {
  const w = boot();
  const a = w.make('Alpha'),
    b = w.make('Beta'),
    c = w.make('Gamma');
  // Another window deletes the first form just as this one saves the second.
  w.beforeLock = () =>
    w.admin({ action: 'admin.forms.delete', id: a.id, confirm: a.slug });
  const saved = w.admin({
    action: 'admin.forms.update',
    id: b.id,
    patch: { title: 'Beta edited' }
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(
    w.forms().map((f) => [f.id, f.title]),
    [
      [b.id, 'Beta edited'],
      [c.id, 'Gamma']
    ]
  );
  assert.equal(
    w.forms().filter((f) => f.id === c.id)[0].sheetId,
    c.sheetId,
    'the form below is untouched'
  );
});

test('Registry: a save based on an older copy is refused and changes nothing', () => {
  const w = boot();
  const f = w.make('Alpha');
  w.advanceDays(0.001);
  const first = w.admin({
    action: 'admin.forms.update',
    id: f.id,
    base: f.updatedAt,
    patch: { title: 'Saved first' }
  });
  assert.equal(first.ok, true);
  const late = w.admin({
    action: 'admin.forms.update',
    id: f.id,
    base: f.updatedAt,
    patch: { status: 'open' }
  });
  assert.equal(late.error.code, 'stale');
  const now = w.forms()[0];
  assert.deepEqual([now.title, now.status], ['Saved first', 'draft']);
  assert.equal(
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      base: now.updatedAt,
      patch: { status: 'open' }
    }).form.status,
    'open'
  );
  assert.equal(
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'closed' }
    }).form.status,
    'closed',
    'a call without a base is not checked'
  );
});

test('Registry: a busy lock refuses the change instead of writing', () => {
  const w = boot();
  const f = w.make('Alpha');
  w.lock.busy = true;
  assert.equal(
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { title: 'Never' }
    }).error.code,
    'busy'
  );
  w.lock.busy = false;
  assert.equal(w.forms()[0].title, 'Alpha');
});

test('Private links: a link keeps its form when the form gets a new link name', () => {
  const w = boot();
  const f = w.make('Alpha');
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { status: 'open' }
  });
  const made = w.admin({
    action: 'admin.clients.create',
    name: 'Dr. Example',
    forms: [f.slug],
    withKey: false
  });
  assert.deepEqual(made.client.forms, [f.id], 'the link stores the form id');
  // A link saved before ids were stored names its form by link name.
  const tab = w.registry.getSheetByName('Clients');
  tab.getRange(2, 4).setValue(JSON.stringify([f.slug]));
  const seen = () =>
    w.api({ action: 'viewer.me', token: made.token }).forms.map((x) => x.title);
  assert.deepEqual(seen(), ['Alpha']);
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { slug: 'alpha-renamed' }
  });
  assert.deepEqual(seen(), ['Alpha']);
  assert.equal(
    String(tab.getRange(2, 4).getValue()),
    JSON.stringify([f.id]),
    'the old row now stores the id'
  );
  w.admin({ action: 'admin.forms.delete', id: f.id, confirm: 'alpha-renamed' });
  assert.deepEqual(
    w.admin({ action: 'admin.clients.list' }).clients[0].forms,
    []
  );
});

test('Lists: a list cannot take the name of another list', () => {
  const w = boot();
  const one = w.admin({
    action: 'admin.lists.create',
    name: 'Alpha',
    kind: 'plain'
  });
  const two = w.admin({
    action: 'admin.lists.create',
    name: 'Beta',
    kind: 'plain'
  });
  assert.equal(
    w.admin({ action: 'admin.lists.rename', key: two.key, name: 'alpha' }).error
      .code,
    'list_name_taken'
  );
  assert.equal(
    w.admin({ action: 'admin.lists.rename', key: two.key, name: 'Levels' })
      .error.code,
    'list_name_taken'
  );
  assert.equal(
    w.admin({ action: 'admin.lists.rename', key: two.key, name: 'Beta' }).ok,
    true,
    'its own name is free'
  );
  assert.equal(
    w.admin({ action: 'admin.lists.rename', key: one.key, name: 'Gamma' }).info[
      one.key
    ].name,
    'Gamma'
  );
});
