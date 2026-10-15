const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, open, AR_NAME } = require('../harness/form-page.js');

const milestones = [
  { id: 'm_a', label: { en: 'Task 1', ar: 'المهمة 1' } },
  { id: 'm_b', label: { en: 'Task 2', ar: 'المهمة 2' } }
];

function registered(students = true) {
  const w = boot('team_registration', {
    progress: { from: 'tasks', milestones, students }
  });
  const r = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@b.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      team_size: '1',
      members: [],
      title: 'Project 1'
    }
  });
  const team = w.admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions[0];
  w.admin({
    action: 'admin.progress.mark',
    slug: w.form.slug,
    submissionId: team.id,
    milestone: 'm_a',
    state: 'discussed',
    teamNote: 'Good work',
    privateNote: 'Check the code'
  });
  return { w, key: r.key };
}

async function openWithKey(w, key) {
  const p = await open(w);
  p.clickText('Edit or cancel with your key');
  await settle();
  p.type('#key-input', key);
  p.submitForm();
  await settle(10);
  return p;
}

test('Student: a key shows the progress above the answers', async () => {
  const { w, key } = registered();
  const p = await openWithKey(w, key);
  const block = p.$('.progress-mine');
  assert.ok(block, 'the summary shows it');
  assert.ok(block.textContent.includes('Your progress'));
  assert.deepEqual(
    p.$$('.progress-mine-list > li').map((li) => li.dataset.milestone),
    ['m_a', 'm_b']
  );
  assert.ok(block.textContent.includes('Discussed'));
  assert.ok(block.textContent.includes('Good work'));
  assert.ok(!block.textContent.includes('Check the code'), 'not the private');
});

test('Student: no progress block when teams do not see it', async () => {
  const { w, key } = registered(false);
  const p = await openWithKey(w, key);
  assert.ok(p.text().includes('Your registration'));
  assert.equal(p.$('.progress-mine'), null);
});

test('Student: an ended key still shows the progress, read only', async () => {
  const { w, key } = registered();
  w.advanceDays(400);
  const p = await openWithKey(w, key);
  assert.ok(p.text().includes('This key has expired'));
  assert.ok(p.$('.progress-mine'));
  assert.ok(p.text().includes('Changes need a new key.'));
  assert.ok(p.$('.progress-mine').textContent.includes('Good work'));
});
