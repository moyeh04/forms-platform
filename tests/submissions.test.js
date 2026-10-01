const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type, title: 'Database Team Project', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open', ...patch } });
  w.form = form;
  w.submit = (data, extra = {}) => w.api({ action: 'submit', slug: form.slug, data, ...extra });
  w.rows = () => w.sheet(form.sheetId, 'Responses').rows();
  return w;
}

const team = (o = {}) => ({
  email: 'Sara@Example.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230999', phone: '+201012345678',
  major: 'حاسبات', level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020',
  members: [{ name: 'سارة خالد حسن علي', phone: '01112345678', code: '4230998', level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' }],
  title: 'Library System', ...o
});

test('Submit: stores a clean row and returns a reference and a 5-digit key', () => {
  const w = boot();
  const r = w.submit(team());
  assert.equal(r.ok, true);
  assert.match(r.ref, /^TR-2027-0001$/);
  assert.match(r.key, /^\d{5}$/);
  assert.ok(Date.parse(r.keyExpires) > Date.parse('2027-09-07T00:00:00Z'));
  const [, row] = w.rows();
  assert.equal(row[6], 'sara@example.com');
  assert.equal(row[8], '4230999');
  assert.equal(row[9], '01012345678');
  assert.ok(row[13].includes('4230998'));
  assert.equal(row[15].includes(r.key), false, 'the key itself is never stored');
});

test('Submit: invalid answers return field errors and store nothing', () => {
  const w = boot();
  const r = w.submit(team({ leader_name: 'Ahmed Mohamed Mahmoud Ahmed', phone: '123' }));
  assert.equal(r.error.code, 'invalid');
  assert.equal(r.error.details.leader_name.error, 'arabic_only');
  assert.equal(r.error.details.phone.error, 'invalid_phone');
  assert.equal(w.rows().length, 1);
});

test('Submit: closed, draft, and not-yet-open forms refuse submissions', () => {
  const w = boot();
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { status: 'closed' } });
  assert.equal(w.submit(team()).error.code, 'form_closed');
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { status: 'open', opensAt: '2027-12-01T00:00:00Z' } });
  assert.equal(w.submit(team()).error.code, 'form_not_yet');
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { status: 'draft', opensAt: '' } });
  assert.equal(w.submit(team()).error.code, 'form_draft');
});

test('Submit: the same leader code cannot register twice', () => {
  const w = boot();
  assert.equal(w.submit(team()).ok, true);
  const again = w.submit(team({ email: 'x@y.com' }));
  assert.equal(again.error.code, 'duplicate');
  assert.equal(w.rows().length, 2);
});

test('Submit: a student already in another team is refused', () => {
  const w = boot();
  w.submit(team());
  const other = team({ leader_code: '4231000', members: [{ name: 'منى أشرف كمال فؤاد', phone: '01212345678', code: '4230998', level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' }] });
  const r = w.submit(other);
  assert.equal(r.error.code, 'duplicate_member');
  assert.deepEqual(r.error.details.codes, ['4230998']);
});

test('Submit: form capacity is enforced', () => {
  const w = boot('team_registration', { rules: { uniqueBy: 'leader_code', uniqueAcrossForm: false, driveCheck: 'strict', maxSubmissions: 1 } });
  assert.equal(w.submit(team()).ok, true);
  assert.equal(w.submit(team({ leader_code: '4231111', members: [] })).error.code, 'form_full');
});

test('Submit: Drive links must open and be shared with anyone', () => {
  const w = boot('task_submission');
  const base = (link) => team({ link, title: 'Normalization' });
  const ok = `https://docs.google.com/presentation/d/${ID('a')}/edit`;
  assert.equal(w.submit(base(ok)).ok, true);

  const hidden = `https://drive.google.com/file/d/${ID('b')}/view`;
  w.drive.setAccess(ID('b'), 'PRIVATE');
  const r1 = w.submit(team({ leader_code: '4231001', members: [], link: hidden, title: 'Task B' }));
  assert.equal(r1.error.details.link.error, 'link_not_public');

  const gone = `https://drive.google.com/file/d/${ID('c')}/view`;
  w.drive.missing.add(ID('c'));
  const r2 = w.submit(team({ leader_code: '4231002', members: [], link: gone, title: 'Task C' }));
  assert.equal(r2.error.details.link.error, 'link_unreachable');

  const folder = `https://drive.google.com/drive/folders/${ID('d')}`;
  const r3 = w.submit(team({ leader_code: '4231003', members: [], link: folder, title: 'Task D' }));
  assert.equal(r3.error.details.link.error, 'link_kind');
});

test('Submit: confirmation email carries the reference and key', () => {
  const w = boot();
  const r = w.submit(team());
  assert.equal(w.mail.length, 1);
  assert.equal(w.mail[0].to, 'sara@example.com');
  assert.ok(w.mail[0].body.includes(r.key));
  assert.ok(w.mail[0].body.includes(r.ref));
});

test('Key: lookup returns the registration and wrong keys are throttled', () => {
  const w = boot();
  const r = w.submit(team());
  const hit = w.api({ action: 'lookup', slug: w.form.slug, key: r.key });
  assert.equal(hit.submission.data.leader_code, '4230999');
  assert.equal(hit.canEdit, true);
  const wrong = r.key === '00000' ? '11111' : '00000';
  for (let i = 0; i < 10; i++) assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: wrong }).error.code, 'bad_key');
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code, 'too_many_attempts');
  w.setNow(w.nowMs + 61000);
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok, true);
});

test('Key: expires after the configured number of days', () => {
  const w = boot();
  const r = w.submit(team());
  w.advanceDays(6);
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok, true);
  w.advanceDays(2);
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code, 'key_expired');
});

test('Key: editing updates the row and keeps the key working', () => {
  const w = boot();
  const r = w.submit(team());
  const upd = w.api({ action: 'update', slug: w.form.slug, key: r.key, data: team({ title: 'Library System v2', members: [] }) });
  assert.equal(upd.ok, true);
  assert.equal(w.rows()[1][10], 'Library System v2');
  assert.equal(w.rows().length, 2, 'edits do not create a second row');
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok, true);
});

test('Key: editing cannot steal another team code', () => {
  const w = boot();
  w.submit(team());
  const b = w.submit(team({ leader_code: '4231234', members: [] }));
  const r = w.api({ action: 'update', slug: w.form.slug, key: b.key, data: team({ leader_code: '4230999', members: [] }) });
  assert.equal(r.error.code, 'duplicate');
});

test('Key: deleting frees the code so the team can register again', () => {
  const w = boot();
  const r = w.submit(team());
  assert.equal(w.api({ action: 'remove', slug: w.form.slug, key: r.key }).removed, true);
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code, 'bad_key');
  const again = w.submit(team());
  assert.equal(again.ok, true);
  assert.notEqual(again.ref, r.ref);
});

test('Key: per-form switches turn editing, deleting, or keys off', () => {
  const w = boot('team_registration', { editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: true } });
  const r = w.submit(team());
  assert.equal(w.api({ action: 'update', slug: w.form.slug, key: r.key, data: team() }).error.code, 'edit_disabled');
  assert.equal(w.api({ action: 'remove', slug: w.form.slug, key: r.key }).ok, true);

  const off = boot('team_registration', { editKey: { enabled: false, days: 7, allowEdit: true, allowDelete: true } });
  const r2 = off.submit(team());
  assert.equal(r2.key, '');
  assert.equal(off.api({ action: 'lookup', slug: off.form.slug, key: '12345' }).error.code, 'key_disabled');
});

test('Key: keys are unique across a form', () => {
  const w = boot();
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const r = w.submit(team({ leader_code: String(4240000 + i), members: [] }));
    assert.equal(seen.has(r.key), false);
    seen.add(r.key);
  }
});

test('WhatsApp form: unique by code and review steps start pending', () => {
  const w = boot('whatsapp_registration');
  const d = (o = {}) => ({
    email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230999',
    level: 'صفر / الأولى', major: 'حاسبات', group: 'A', section: '21', schedule: `https://drive.google.com/file/d/${ID('e')}/view`, ...o
  });
  const r = w.submit(d());
  assert.equal(r.ok, true);
  assert.match(r.ref, /^WA-/);
  assert.equal(w.submit(d({ phone: '01112223334' })).error.code, 'duplicate');
  const list = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  assert.deepEqual(list[0].review, { schedule: 'pending', group: 'pending' });
});

test('Admin: list, change status and review, reset key, delete', () => {
  const w = boot('whatsapp_registration');
  const sub = w.submit({
    email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230999', level: 'صفر / الأولى',
    major: 'حاسبات', group: 'B', section: '3', schedule: `https://drive.google.com/file/d/${ID('f')}/view`
  });
  const list = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  assert.equal(list.length, 1);
  assert.equal(list[0].keyHash, undefined);
  assert.equal(w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: list[0].id, patch: { status: 'bogus' } }).error.code, 'bad_status');
  w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: list[0].id, patch: { status: 'in_review', review: { schedule: 'approved' } } });
  const after = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0];
  assert.equal(after.status, 'in_review');
  assert.deepEqual(after.review, { schedule: 'approved', group: 'pending' });

  const reset = w.admin({ action: 'admin.submission.resetKey', slug: w.form.slug, submissionId: list[0].id });
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: sub.key }).error.code, 'bad_key');
  assert.equal(w.api({ action: 'lookup', slug: w.form.slug, key: reset.key }).ok, true);

  w.admin({ action: 'admin.submission.delete', slug: w.form.slug, submissionId: list[0].id });
  assert.equal(w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions.length, 0);
  assert.equal(w.admin({ action: 'admin.submissions', slug: w.form.slug, includeDeleted: true }).submissions.length, 1);
});
