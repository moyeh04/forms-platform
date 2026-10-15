const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, helpers, settle } = require('../harness/dom.js');
const {
  boot,
  openAdmin,
  person,
  member,
  submit
} = require('../harness/admin-page.js');

const milestones = [
  { id: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
  { id: 'm_b', label: { en: 'Task 2', ar: 'Task 2' } }
];

function world() {
  const w = boot();
  const f = w.make('team_registration', 'Projects', {
    progress: { from: 'tasks', milestones }
  });
  submit(
    w,
    f,
    person({
      title: 'Alpha',
      members: [member('سارة خالد حسن علي', '4230002')]
    })
  );
  w.client = (progress) =>
    w.admin({
      action: 'admin.clients.create',
      name: 'Instructor 1',
      forms: ['*'],
      withKey: false,
      progress
    }).token;
  return { w, f };
}

async function openViewer(w, token) {
  const dom = await openPage('viewer.html', w, { query: `?t=${token}` });
  await dom.window.App.viewer.start();
  await settle(10);
  return { win: dom.window, ...helpers(dom.window) };
}

test('Viewer: a link that may mark sets a state from the board', async () => {
  const { w, f } = world();
  const p = await openViewer(w, w.client('mark'));
  assert.ok(p.$('.team-card').textContent.includes('0 of 2 discussed'));
  p.click('[name="view-progress"]');
  await settle();
  p.click('[name="cell-1-m_b"]');
  p.click('.mark-box [name="state-submitted"]');
  await settle(12);
  const team = w.admin({ action: 'admin.submissions', slug: f.slug })
    .submissions[0];
  assert.equal(team.progress.m_b.s, 'submitted');
  assert.match(team.progress.m_b.by, /^c:/, 'the mark names the link');
  assert.ok(p.$('[name="cell-1-m_b"]').classList.contains('is-submitted'));
});

test('Viewer: a link that may only see has no states to pick', async () => {
  const { w, f } = world();
  const team = w.admin({ action: 'admin.submissions', slug: f.slug })
    .submissions[0];
  w.admin({
    action: 'admin.progress.mark',
    slug: f.slug,
    submissionId: team.id,
    milestone: 'm_a',
    state: 'discussed',
    teamNote: 'Good work'
  });
  const p = await openViewer(w, w.client('see'));
  p.click('[name="view-progress"]');
  await settle();
  assert.ok(p.$('[name="cell-1-m_a"]'), 'a note can be read');
  assert.equal(p.$('button[name="cell-1-m_b"]'), null, 'nothing to open');
  p.click('[name="cell-1-m_a"]');
  assert.equal(p.$('.mark-box [name="teamNote"]'), null);
  assert.ok(p.$('.mark-box').textContent.includes('Good work'));
  assert.ok(p.$('.mark-box [name="state-discussed"]').disabled);
});

test('Viewer: a hidden link shows none; its dialog changes it', async () => {
  const { w } = world();
  const token = w.client('hidden');
  const p = await openViewer(w, token);
  assert.equal(p.$('[name="view-progress"]'), null);
  assert.ok(!p.$('.team-card').textContent.includes('discussed'));

  const a = await openAdmin(w, '#/clients');
  const row = a.$('[data-client]');
  assert.ok(row.textContent.includes('Hidden'));
  a.clickText('Edit', row);
  const sel = a.$('.dialog [name="progress"]');
  assert.equal(sel.value, 'hidden');
  sel.value = 'mark';
  a.fire(sel, 'change');
  a.clickText('Save', a.$('.dialog'));
  await settle(12);
  const c = w
    .admin({ action: 'admin.clients.list' })
    .clients.find((x) => x.id === row.dataset.client);
  assert.equal(c.progress, 'mark');
});
