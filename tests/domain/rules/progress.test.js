const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');
const { ProgressState } = require('../../../domain/enums.js');

const milestones = [
  { id: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
  { id: 'm_b', label: { en: 'Task 2', ar: 'Task 2' } },
  { id: 'm_c', label: { en: 'Task 3', ar: 'Task 3' } }
];
const form = {
  type: 'team_registration',
  progress: { from: 'tasks', milestones, students: true }
};

test('Progress: only a team registration with milestones has it', () => {
  assert.equal(R.progressOn(form), true);
  assert.equal(R.progressForStudents(form), true);
  assert.equal(R.progressOn({ ...form, type: 'task_submission' }), false);
  assert.equal(R.progressOn({ type: 'team_registration' }), false);
  assert.equal(
    R.progressForStudents({
      ...form,
      progress: { ...form.progress, students: false }
    }),
    false
  );
});

test('Progress: a list becomes milestones, and a saved copy is cleaned', () => {
  assert.deepEqual(
    R.milestonesFromList([
      { value: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
      { value: 'm_b', label: { en: 'Task 2' } }
    ]),
    [
      { id: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
      { id: 'm_b', label: { en: 'Task 2', ar: 'Task 2' } }
    ]
  );
  assert.deepEqual(R.cleanProgress(null), { ok: true, value: null });
  assert.deepEqual(R.cleanProgress({ from: 'x', milestones: [] }).value, null);
  assert.deepEqual(
    R.cleanProgress({
      from: 'tasks',
      milestones: [{ id: ' m_a ', label: { en: ' Task 1 ' } }]
    }).value,
    {
      from: 'tasks',
      milestones: [{ id: 'm_a', label: { en: 'Task 1', ar: 'Task 1' } }],
      students: true
    }
  );
  for (const bad of [
    [{ id: 'm_a', label: { en: '' } }],
    [{ id: '', label: { en: 'A' } }],
    [
      { id: 'm_a', label: { en: 'A' } },
      { id: 'm_a', label: { en: 'B' } }
    ]
  ]) {
    assert.equal(
      R.cleanProgress({ milestones: bad }).error,
      'bad_progress',
      JSON.stringify(bad)
    );
  }
});

test('Progress: a mark changes its time only with its state', () => {
  assert.deepEqual(R.readProgress(''), {});
  assert.deepEqual(R.readProgress('not json'), {});
  assert.deepEqual(R.readProgress('[1]'), {});
  assert.equal(R.markOf({}, 'm_a').s, ProgressState.NOT_YET);
  let p = R.applyMark({}, 'm_a', { state: 'submitted' }, { at: 'T1', by: 'a' });
  assert.deepEqual(p.m_a, { s: 'submitted', t: '', p: '', at: 'T1', by: 'a' });
  p = R.applyMark(
    p,
    'm_a',
    { teamNote: ' Fix the table ' },
    { at: 'T2', by: 'c:x' }
  );
  assert.deepEqual(
    p.m_a,
    { s: 'submitted', t: 'Fix the table', p: '', at: 'T1', by: 'a' },
    'a note keeps the time and who'
  );
  assert.equal(R.markStale(p, 'm_a', 'T1'), false);
  assert.equal(R.markStale(p, 'm_a', ''), true, 'the page saw no mark');
  assert.equal(R.markStale(p, 'm_b', undefined), false);
  p = R.applyMark(
    p,
    'm_a',
    { state: 'not_yet', teamNote: '' },
    { at: 'T3', by: 'a' }
  );
  assert.deepEqual(p, {}, 'Not yet with no notes is no mark');
});

test('Progress: a change is refused for a milestone, state or note', () => {
  assert.equal(R.markProblem(form, 'm_a', { state: 'discussed' }), '');
  assert.equal(R.markProblem(form, 'm_z', {}), 'bad_milestone');
  assert.equal(R.markProblem(form, 'm_a', { state: 'done' }), 'bad_state');
  assert.equal(
    R.markProblem(form, 'm_a', {
      privateNote: 'x'.repeat(R.PROGRESS_NOTE_MAX + 1)
    }),
    'note_too_long'
  );
  assert.equal(
    R.markProblem(form, 'm_a', { teamNote: 'x'.repeat(R.PROGRESS_NOTE_MAX) }),
    ''
  );
});

test('Progress: counts, marks per milestone, and what each one sees', () => {
  const team = {
    m_a: { s: 'discussed', t: 'Good', p: 'Check the code', at: 'T', by: 'a' },
    m_b: { s: 'submitted', t: '', p: '', at: 'T', by: 'c:x' },
    m_gone: { s: 'discussed', t: '', p: '', at: 'T', by: 'a' }
  };
  assert.deepEqual(R.progressCount(form, team), {
    discussed: 1,
    submitted: 1,
    total: 3
  });
  assert.deepEqual(R.markCounts([team, { m_a: { s: 'not_yet' } }, null]), {
    m_a: 1,
    m_b: 1,
    m_gone: 1
  });
  assert.deepEqual(
    R.studentProgress(form, team).map((x) => [x.id, x.state, x.note]),
    [
      ['m_a', 'discussed', 'Good'],
      ['m_b', 'submitted', ''],
      ['m_c', 'not_yet', '']
    ],
    'a team sees its note, never the private one'
  );
  assert.deepEqual(R.linkProgress(form, team), {
    m_a: { s: 'discussed', t: 'Good', p: 'Check the code', at: 'T' },
    m_b: { s: 'submitted', t: '', p: '', at: 'T' }
  });
});

test('Progress: the copy of a form is compared with its list by id', () => {
  const same = R.milestonesDiff(milestones, milestones);
  assert.equal(same.same, true);
  const list = [
    milestones[1],
    { id: 'm_a', label: { en: 'Proposal', ar: 'المهمة 1' } },
    { id: 'm_d', label: { en: 'Task 4', ar: 'Task 4' } }
  ];
  const d = R.milestonesDiff(milestones, list);
  assert.deepEqual(
    d.added.map((m) => m.id),
    ['m_d']
  );
  assert.deepEqual(
    d.removed.map((m) => m.id),
    ['m_c']
  );
  assert.deepEqual(
    d.renamed.map((m) => m.label.en),
    ['Proposal']
  );
  assert.equal(d.moved, true);
  assert.equal(d.same, false);
});
