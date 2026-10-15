const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const {
  boot,
  openAdmin,
  person,
  member,
  submit
} = require('../harness/admin-page.js');

const values = [
  { value: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
  { value: 'm_b', label: { en: 'Task 2', ar: 'Task 2' } }
];

function withList(w) {
  const { key } = w.admin({
    action: 'admin.lists.create',
    name: 'Milestones',
    kind: 'milestones'
  });
  w.admin({ action: 'admin.lists.set', key, values });
  return key;
}

test(
  'Progress: a team registration copies a milestones list and keeps the ' +
    'copy until Update from list',
  async () => {
    const w = boot();
    const key = withList(w);
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const sel = p.$('[name="progress-from"]');
    sel.value = key;
    p.fire(sel, 'change');
    await settle();
    assert.deepEqual(
      p.$$('.progress-copy li').map((li) => li.firstChild.textContent),
      ['Task 1', 'Task 2']
    );
    assert.ok(p.$('[name="progress-students"]'), 'keys are on by default');
    p.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(saved.progress.from, key);
    assert.equal(saved.progress.milestones.length, 2);

    w.admin({
      action: 'admin.lists.set',
      key,
      values: [...values, { value: 'm_c', label: { en: 'Task 3' } }]
    });
    const q = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(q.$$('.progress-copy li').length, 2, 'the copy stays');
    assert.ok(q.$('.progress-update').textContent.includes('1 added'));
    q.click('[name="progress-update"]');
    await settle();
    assert.equal(q.$$('.progress-copy li').length, 3);
    assert.equal(q.$('[name="progress-update"]'), null);
  }
);

test('Progress: with keys off, teams are not shown progress', async () => {
  const w = boot();
  const key = withList(w);
  const f = w.make('team_registration', 'Projects');
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: {
      editKey: { enabled: false, days: 3, allowEdit: true, allowDelete: true },
      progress: {
        from: key,
        milestones: values.map((v) => ({ id: v.value, label: v.label }))
      }
    }
  });
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="progress-students"]'), null);
  assert.ok(p.$('[name="progress-students-off"]'));
});

test(
  'Progress: the board marks a team, and its card counts what was ' +
    'discussed',
  async () => {
    const w = boot();
    const key = withList(w);
    const f = w.make('team_registration', 'Projects', {
      progress: {
        from: key,
        milestones: values.map((v) => ({ id: v.value, label: v.label }))
      }
    });
    submit(
      w,
      f,
      person({
        title: 'Alpha',
        members: [member('سارة خالد حسن علي', '4230002')]
      })
    );
    const p = await openAdmin(w, `#/f/${f.slug}`);
    assert.ok(p.text().includes('0 of 2 discussed'), 'the card counts');
    p.click('[name="view-progress"]');
    await settle();
    assert.ok(p.$('.progress-table'));
    p.click('[name="cell-1-m_a"]');
    await settle();
    assert.ok(p.$('.mark-box'));
    p.click('.mark-box [name="state-discussed"]');
    await settle(12);
    const team = w
      .admin({ action: 'admin.submissions', slug: f.slug })
      .submissions.find((s) => s.number === 1);
    assert.equal(team.progress.m_a.s, 'discussed');
    p.type('.mark-box [name="teamNote"]', 'Good work');
    assert.equal(p.$('.mark-box [name="save-teamNote"]').hidden, false);
    p.click('.mark-box [name="save-teamNote"]');
    await settle(12);
    p.click('[name="mark-done"]');
    assert.equal(p.$('.mark-box'), null);
    assert.ok(p.$('[name="cell-1-m_a"]').classList.contains('is-discussed'));
    assert.ok(p.$('[name="cell-1-m_a"] .icon-note, [name="cell-1-m_a"] svg'));
    assert.equal(
      p.win.sessionStorage.getItem(`progress-view:${f.slug}`),
      'progress',
      'the tab keeps the view'
    );
  }
);
