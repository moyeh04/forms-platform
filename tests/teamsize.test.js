const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/rules.js');
const { createWorld } = require('./harness/appsscript-mock.js');

const form = {
  rules: { teamSize: { min: 2, max: 4 } },
  fields: [
    { id: 'leader_code', type: 'code', role: 'code' },
    { id: 'team_size', type: 'team_size', role: 'team_size' },
    { id: 'members', type: 'members', role: 'members', fields: [
      { id: 'name', type: 'arabic_name', role: 'name' },
      { id: 'code', type: 'code', role: 'code' }
    ] }
  ]
};
const m = (code) => ({ name: 'سارة خالد حسن علي', code });

test('Team size: range comes from the rules and defaults to 1 to 6', () => {
  assert.deepEqual(R.teamSizeRange(form), { min: 2, max: 4 });
  assert.deepEqual(R.teamSizeRange({}), { min: 1, max: 6 });
  assert.deepEqual(R.teamSizeRange({ rules: { teamSize: { min: 3 } } }), { min: 3, max: 6 });
});

test('Team size: the question is required and must be inside the range', () => {
  const base = { leader_code: '4230001', members: [m('4230002')] };
  assert.equal(R.validateSubmission(form, base).errors.team_size.error, 'required');
  assert.equal(R.validateSubmission(form, { ...base, team_size: '1' }).errors.team_size.error, 'invalid_team_size');
  assert.equal(R.validateSubmission(form, { ...base, team_size: '5' }).errors.team_size.params.max, 4);
  assert.equal(R.validateSubmission(form, { ...base, team_size: 'abc' }).errors.team_size.error, 'invalid_team_size');
  assert.equal(R.validateSubmission(form, { ...base, team_size: '٢' }).ok, true, 'Arabic digits are accepted');
});

test('Team size: the chosen size decides exactly how many member forms are needed', () => {
  const d = (size, members) => ({ leader_code: '4230001', team_size: size, members });
  assert.equal(R.validateSubmission(form, d('3', [m('4230002'), m('4230003')])).ok, true);
  assert.equal(R.validateSubmission(form, d('3', [m('4230002')])).errors.members.error, 'members_count');
  assert.equal(R.validateSubmission(form, d('2', [m('4230002'), m('4230003')])).errors.members.params.count, 1);
  assert.equal(R.validateSubmission(form, d('2', undefined)).errors.members.error, 'members_count', 'members are not optional');
});

test('Team size: a solo team needs no members when one is allowed', () => {
  const solo = { ...form, rules: { teamSize: { min: 1, max: 3 } } };
  assert.equal(R.validateSubmission(solo, { leader_code: '4230001', team_size: '1', members: [] }).ok, true);
});

test('Team size: member details are still checked once the count matches', () => {
  const r = R.validateSubmission(form, { leader_code: '4230001', team_size: '2', members: [{ name: 'سارة', code: '1' }] });
  assert.equal(r.errors.members.nested['0.name'].error, 'arabic_parts');
  assert.equal(r.errors.members.nested['0.code'].error, 'invalid_code');
});

test('Team size: forms that hide the question keep the range-based member limits', () => {
  const hidden = { ...form, fields: form.fields.map((f) => (f.id === 'team_size' ? { ...f, enabled: false } : f)) };
  assert.equal(R.validateSubmission(hidden, { leader_code: '4230001', members: [] }).errors.members.error, 'too_few_members');
  assert.equal(R.validateSubmission(hidden, { leader_code: '4230001', members: [m('4230002')] }).ok, true);
});

function boot(type = 'team_registration') {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.form = w.admin({ action: 'admin.forms.create', type, title: 'Teams', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { status: 'open' } });
  w.get = () => w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  w.submit = (data) => w.api({ action: 'submit', slug: w.form.slug, data });
  return w;
}

const leader = {
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678',
  major: 'حاسبات', level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Library System'
};
const member = (code) => ({ name: 'سارة خالد حسن علي', phone: '01112345678', code, level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });

test('Templates: projects allow 1 to 6 people, tasks 1 to 5, and the question is mandatory', () => {
  assert.deepEqual(boot('team_registration').get().rules.teamSize, { min: 1, max: 6 });
  const tasks = boot('task_submission').get();
  assert.deepEqual(tasks.rules.teamSize, { min: 1, max: 5 });
  const size = tasks.fields.find((f) => f.id === 'team_size');
  assert.equal(size.required, true);
  assert.equal(tasks.fields.find((f) => f.id === 'members').required, true);
  assert.deepEqual(tasks.steps.find((s) => s.id === 'members').fields, ['team_size', 'members']);
  assert.equal(boot('reservation').get().fields.some((f) => f.role === 'team_size'), false);
});

test('Admin: minimum and maximum team size are saved and enforced on submissions', () => {
  const w = boot();
  const r = w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { rules: { teamSize: { min: 3, max: 4 } } } });
  assert.deepEqual(r.form.rules.teamSize, { min: 3, max: 4 });
  assert.equal(r.form.rules.uniqueBy, 'leader_code', 'other rules are kept');
  assert.equal(w.submit({ ...leader, team_size: '2', members: [member('4230002')] }).error.details.team_size.error, 'invalid_team_size');
  assert.equal(w.submit({ ...leader, team_size: '5', members: [1, 2, 3, 4].map((i) => member('423010' + i)) }).error.details.team_size.error, 'invalid_team_size');
  assert.equal(w.submit({ ...leader, team_size: '3', members: [member('4230002'), member('4230003')] }).ok, true);
});

test('Admin: an impossible range is refused with a clear message', () => {
  const w = boot();
  const patch = (teamSize) => w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { rules: { teamSize } } });
  assert.equal(patch({ min: 0, max: 3 }).error.code, 'bad_team_size');
  assert.equal(patch({ min: 4, max: 3 }).error.code, 'bad_team_size');
  assert.equal(patch({ min: 1, max: 21 }).error.code, 'bad_team_size');
  assert.equal(patch({ min: '2', max: '5' }).ok, true, 'numbers typed as text are accepted');
});

test('Students: the public form exposes the range so the page can offer the right choices', () => {
  const w = boot();
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { rules: { teamSize: { min: 2, max: 3 } } } });
  assert.deepEqual(w.api({ action: 'getForm', slug: w.form.slug }).form.rules.teamSize, { min: 2, max: 3 });
});

test('Admin: changing the range warns how many saved teams now fall outside it', () => {
  const w = boot();
  w.submit({ ...leader, team_size: '1', members: [] });
  w.submit({ ...leader, leader_code: '4230005', team_size: '3', members: [member('4230006'), member('4230007')] });
  const r = w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { rules: { teamSize: { min: 2, max: 4 } } } });
  assert.equal(r.teamSizeConflicts, 1);
});

test('Admin: editing a team through the dashboard keeps the size and members in step', () => {
  const w = boot();
  w.submit({ ...leader, team_size: '2', members: [member('4230002')] });
  const sub = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0];
  const bad = w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: sub.id, patch: { data: { ...sub.data, team_size: '3' } } });
  assert.equal(bad.error.details.members.error, 'members_count');
  const good = w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: sub.id, patch: { data: { ...sub.data, team_size: '3', members: [member('4230002'), member('4230003')] } } });
  assert.equal(good.ok, true);
});

test('Size note: only the chosen sizes get it, with {n} and {max} filled in', () => {
  const f = { rules: { teamSize: { min: 1, max: 5, notice: { sizes: [3, 4], text: { en: 'Teams of {n} grow to {max}.', ar: 'فريق {n} يكمل {max}' } } } } };
  assert.equal(R.teamSizeNotice(f, '3', 'en'), 'Teams of 3 grow to 5.');
  assert.equal(R.teamSizeNotice(f, 4, 'ar'), 'فريق 4 يكمل 5');
  assert.equal(R.teamSizeNotice(f, '5', 'en'), '');
  assert.equal(R.teamSizeNotice({ rules: { teamSize: { min: 1, max: 5 } } }, '3', 'en'), '');
  assert.equal(R.teamSizeNotice({ rules: { teamSize: { min: 1, max: 5, notice: { sizes: [3], text: { en: 'Only English' } } } } }, '3', 'ar'), 'Only English', 'falls back to English');
});

test('Size note: saved with the range, cleaned, kept on later saves, and public', () => {
  const w = boot();
  const save = (teamSize) => w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { rules: { teamSize } } });
  const r = save({ min: 1, max: 5, notice: { sizes: ['4', 3, 3, 9], text: { en: '  Others join to reach {max}. ', ar: '' } } });
  assert.deepEqual(r.form.rules.teamSize.notice, { sizes: [3, 4], text: { en: 'Others join to reach {max}.', ar: '' } }, 'sizes outside the range and repeats are dropped');
  assert.deepEqual(save({ min: 1, max: 4 }).form.rules.teamSize.notice.sizes, [3, 4], 'a save without a note keeps the old one');
  assert.deepEqual(w.api({ action: 'getForm', slug: w.form.slug }).form.rules.teamSize.notice.sizes, [3, 4]);
  assert.equal(save({ min: 1, max: 4, notice: null }).form.rules.teamSize.notice, undefined, 'null removes it');
});
