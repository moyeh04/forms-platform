const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

const milestones = [
  { id: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
  { id: 'm_b', label: { en: 'Task 2', ar: 'Task 2' } }
];

const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const team = (code, title) =>
  sized({
    email: 'a@b.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: code,
    phone: '01012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    title
  });

function boot() {
  const w = createWorld({ now: Date.parse('2027-10-01T09:00:00Z') });
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.form = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Projects',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: {
      status: 'open',
      progress: { from: 'tasks', milestones, students: true }
    }
  });
  w.one = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: team('4230001', 'Library')
  });
  w.two = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: team('4230002', 'Clinic')
  });
  w.rows = () =>
    w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  w.idOf = (title) => w.rows().find((r) => r.title === title).id;
  w.mark = (o) =>
    w.admin({
      action: 'admin.progress.mark',
      slug: w.form.slug,
      submissionId: w.idOf('Library'),
      milestone: 'm_a',
      ...o
    });
  w.client = (o = {}) =>
    w.admin({
      action: 'admin.clients.create',
      name: 'Instructor 1',
      forms: [w.form.slug],
      withKey: false,
      ...o
    });
  return w;
}

test('Progress: a form keeps clean milestones, on team forms only', () => {
  const w = boot();
  const got = w.admin({ action: 'admin.forms.get', id: w.form.id });
  assert.deepEqual(got.form.progress.milestones, milestones);
  assert.deepEqual(got.progressMarks, {});
  assert.equal(
    w.admin({
      action: 'admin.forms.update',
      id: w.form.id,
      patch: { progress: { milestones: [{ id: 'm_a', label: { en: '' } }] } }
    }).error.code,
    'bad_progress'
  );
  const tasks = w.admin({
    action: 'admin.forms.create',
    type: 'task_submission',
    title: 'Tasks',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: tasks.id,
    patch: { progress: { milestones } }
  });
  assert.equal(
    w.admin({ action: 'admin.forms.get', id: tasks.id }).form.progress,
    null
  );
  const copy = w.admin({
    action: 'admin.forms.duplicate',
    id: w.form.id,
    title: 'Projects again',
    term: 'Spring 2028'
  });
  assert.deepEqual(
    copy.form.progress.milestones,
    milestones,
    'a copy of the form keeps its milestones'
  );
});

test('Progress: the admin marks one cell, which no other save loses', () => {
  const w = boot();
  const before = w.rows().find((r) => r.title === 'Library');
  w.setNow('2027-10-02T09:00:00Z');
  const out = w.mark({ state: 'submitted', teamNote: ' Fix the table ' });
  assert.deepEqual(out.progress.m_a, {
    s: 'submitted',
    t: 'Fix the table',
    p: '',
    at: '2027-10-02T09:00:00.000Z',
    by: 'a'
  });
  const after = w.rows().find((r) => r.title === 'Library');
  assert.equal(after.updated, before.updated, 'a mark is not an edit');
  assert.equal(after.status, before.status);
  assert.deepEqual(
    w.admin({ action: 'admin.forms.get', id: w.form.id }).progressMarks,
    { m_a: 1 }
  );

  w.admin({
    action: 'admin.submission.update',
    slug: w.form.slug,
    submissionId: after.id,
    patch: { status: 'approved' }
  });
  w.api({
    action: 'update',
    slug: w.form.slug,
    key: w.one.key,
    data: team('4230001', 'Library 2')
  });
  const kept = w.rows().find((r) => r.id === after.id);
  assert.equal(kept.title, 'Library 2');
  assert.equal(kept.progress.m_a.s, 'submitted', 'whole-row saves keep it');
});

test('Progress: a mark on a stale state or a bad input is refused', () => {
  const w = boot();
  w.mark({ state: 'submitted' });
  const second = w.admin({
    action: 'admin.progress.mark',
    slug: w.form.slug,
    submissionId: w.idOf('Library'),
    milestone: 'm_b',
    state: 'discussed'
  });
  assert.deepEqual(Object.keys(second.progress).sort(), ['m_a', 'm_b']);
  const stale = w.mark({ state: 'discussed', baseAt: '' });
  assert.equal(stale.error.code, 'changed_meanwhile');
  assert.equal(stale.error.details.progress.m_a.s, 'submitted');
  const at = stale.error.details.progress.m_a.at;
  assert.equal(w.mark({ state: 'discussed', baseAt: at }).ok, true);
  for (const [o, code] of [
    [{ milestone: 'm_z', state: 'submitted' }, 'bad_milestone'],
    [{ state: 'done' }, 'bad_state'],
    [{ privateNote: 'x'.repeat(501) }, 'note_too_long'],
    [{ submissionId: 'nope', state: 'submitted' }, 'submission_not_found']
  ]) {
    assert.equal(w.mark(o).error.code, code, code);
  }
});

test('Progress: a link sees, marks or hides it as its setting says', () => {
  const w = boot();
  w.mark({ state: 'discussed', privateNote: 'Strong' });
  const see = w.client();
  assert.equal(see.client.progress, 'see', 'a new link can see');
  const data = w.api({
    action: 'viewer.data',
    token: see.token,
    slug: w.form.slug
  });
  assert.deepEqual(data.milestones, milestones);
  assert.equal(data.progressAccess, 'see');
  const lib = data.groups.find((g) => g.title === 'Library');
  assert.deepEqual(lib.progress.m_a, {
    s: 'discussed',
    t: '',
    p: 'Strong',
    at: '2027-10-01T09:00:00.000Z'
  });
  const viewerMark = (token, o = {}) =>
    w.api({
      action: 'viewer.progress.mark',
      token,
      slug: w.form.slug,
      submissionId: lib.id,
      milestone: 'm_b',
      state: 'submitted',
      ...o
    });
  assert.equal(viewerMark(see.token).error.code, 'forbidden');

  const mark = w.client({ progress: 'mark' });
  const out = viewerMark(mark.token);
  assert.equal(out.progress.m_b.s, 'submitted');
  assert.equal(out.progress.m_b.by, undefined, 'a link never sees who');
  assert.equal(
    w.rows().find((r) => r.id === lib.id).progress.m_b.by,
    'c:' + mark.client.id
  );

  w.admin({
    action: 'admin.clients.update',
    id: see.client.id,
    patch: { progress: 'hidden' }
  });
  const hidden = w.api({
    action: 'viewer.data',
    token: see.token,
    slug: w.form.slug
  });
  assert.equal(hidden.milestones, undefined);
  assert.equal(hidden.groups[0].progress, undefined);
});

test('Progress: a team sees its own, even with an expired key', () => {
  const w = boot();
  w.mark({ state: 'discussed', teamNote: 'Well done', privateNote: 'Strong' });
  const look = w.api({ action: 'lookup', slug: w.form.slug, key: w.one.key });
  assert.deepEqual(look.progress, [
    {
      id: 'm_a',
      label: milestones[0].label,
      state: 'discussed',
      note: 'Well done'
    },
    { id: 'm_b', label: milestones[1].label, state: 'not_yet', note: '' }
  ]);
  w.advanceDays(400);
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: w.one.key }).error.code,
    'key_expired'
  );
  const mine = w.api({
    action: 'progress.mine',
    slug: w.form.slug,
    key: w.one.key
  });
  assert.equal(mine.progress[0].note, 'Well done');
  assert.equal(
    w.api({ action: 'progress.mine', slug: w.form.slug, key: 'wrong' }).error
      .code,
    'bad_key'
  );
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: { progress: { from: 'tasks', milestones, students: false } }
  });
  assert.equal(
    w.api({ action: 'progress.mine', slug: w.form.slug, key: w.one.key })
      .progress,
    null
  );
});
