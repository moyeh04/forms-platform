const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Database Team Project',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  w.submit = (data, extra = {}) =>
    w.api({ action: 'submit', slug: form.slug, data, ...extra });
  w.rows = () => w.sheet(form.sheetId, 'Responses').rows();
  return w;
}

const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const team = (o = {}) =>
  sized({
    email: 'Sara@Example.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: '4230999',
    phone: '+201012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    members: [
      {
        name: 'سارة خالد حسن علي',
        phone: '01112345678',
        code: '4230998',
        level: 'صفر / الأولى',
        curriculum: '2020',
        section: '4C-TH1'
      }
    ],
    title: 'Library System',
    ...o
  });

/* ── Team numbers ─────────────────────────────────────────────── */

const squad = (n) =>
  team({
    leader_code: '42300' + n + '1',
    title: 'Project ' + n,
    members: [
      {
        name: 'سارة خالد حسن علي',
        phone: '01112345678',
        code: '42300' + n + '2',
        level: 'صفر / الأولى',
        curriculum: '2020',
        section: '4C-TH1'
      }
    ]
  });
const numbers = (w) =>
  w
    .admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions.map((x) => x.title + ' is ' + x.number);
const NUMBER = 20;

test(
  'Team numbers: a team keeps its number when another one cancels, and ' +
    'the gap stays',
  () => {
    const w = boot();
    const keys = [1, 2, 3].map((n) => {
      w.advanceDays(0.01);
      return w.submit(squad(n)).key;
    });
    assert.deepEqual(numbers(w), [
      'Project 1 is 1',
      'Project 2 is 2',
      'Project 3 is 3'
    ]);
    assert.equal(
      w.api({ action: 'remove', slug: w.form.slug, key: keys[1] }).removed,
      true
    );
    assert.deepEqual(
      numbers(w),
      ['Project 1 is 1', 'Project 3 is 3'],
      'the third team is still Team 3'
    );
    w.advanceDays(0.01);
    w.submit(squad(4));
    assert.deepEqual(
      numbers(w),
      ['Project 1 is 1', 'Project 3 is 3', 'Project 4 is 4'],
      'the number of a cancelled team is not given again'
    );
    assert.deepEqual(
      w.rows().map((row) => row[NUMBER - 1]),
      ['number', '1', '2', '3', '4'],
      'the sheet holds the numbers, also of the cancelled team'
    );
    assert.deepEqual(
      w
        .call(
          'TeamsService.teamBlocks',
          w.call('FormsRepository.findForm', w.form.id)
        )
        .map((t) => t.number),
      [1, 3, 4],
      'the sheet view, the print and the download read the same numbers'
    );
    const sub = w.admin({ action: 'admin.submissions', slug: w.form.slug })
      .submissions[0];
    assert.equal(
      w.admin({
        action: 'admin.submission.delete',
        slug: w.form.slug,
        submissionId: sub.id
      }).deleted,
      true
    );
    assert.deepEqual(
      numbers(w),
      ['Project 3 is 3', 'Project 4 is 4'],
      'a team deleted by the admin leaves a gap too'
    );
  }
);

test(
  'Team numbers: teams registered before the column existed keep the ' +
    'numbers they showed',
  () => {
    const w = boot();
    const keys = [1, 2, 3].map((n) => {
      w.advanceDays(0.01);
      return w.submit(squad(n)).key;
    });
    const sheet = w.sheet(w.form.sheetId, 'Responses');
    for (let row = 1; row <= 4; row++) sheet.set(row, NUMBER, '');
    assert.deepEqual(
      numbers(w),
      ['Project 1 is 1', 'Project 2 is 2', 'Project 3 is 3'],
      'shown as before, although nothing is stored'
    );
    assert.equal(
      w.api({ action: 'remove', slug: w.form.slug, key: keys[0] }).removed,
      true
    );
    assert.deepEqual(
      numbers(w),
      ['Project 2 is 2', 'Project 3 is 3'],
      'the first cancellation stores them and moves nobody up'
    );
    assert.deepEqual(
      w.rows().map((row) => row[NUMBER - 1]),
      ['number', '1', '2', '3']
    );
    assert.equal(sheet.formats.get('3,' + NUMBER), '@', 'written as text');
  }
);

test('Team numbers: a booking or a WhatsApp registration gets none', () => {
  const w = boot('whatsapp_registration');
  const f = w.call('FormsRepository.findForm', w.form.id);
  const rows = [{ created: '2027-09-01T00:00:00Z', deleted: false }];
  w.call('TeamNumbers.keepTeamNumbers', f, rows);
  assert.equal(rows[0].number, undefined);
  assert.equal(
    w.rows()[0].indexOf('number'),
    NUMBER - 1,
    'the column is there, and stays empty'
  );
});
