const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type: 'whatsapp_registration', title: 'Group A and B', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open' } });
  w.form = form;
  w.reg = (code, phone, group = 'A') => w.api({
    action: 'submit', slug: form.slug,
    data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone, code, level: 'صفر / الأولى', major: 'حاسبات', group, section: '21', schedule: `https://drive.google.com/file/d/${ID('t')}/view` }
  });
  w.import = (text) => w.admin({ action: 'admin.matching.import', slug: form.slug, text });
  w.list = () => w.admin({ action: 'admin.matching.list', slug: form.slug });
  return w;
}

test('Import: reads numbers in any format, skips repeats, reports lines it cannot read', () => {
  const w = boot();
  const r = w.import('Sara Ali  +20 10 1234 5678\n01112345678\n\n٠١٢١٢٣٤٥٦٧٨\nno number here\n+201012345678');
  assert.equal(r.added, 3);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(r.unparsed)), ['no number here']);
  const again = w.import('01112345678');
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 1);
  const list = w.list().requests;
  assert.equal(list[0].label, 'Sara Ali');
  assert.equal(list[0].phone, '01012345678');
});

test('List: each request is matched, unmatched, or duplicate by normalized phone', () => {
  const w = boot();
  w.reg('4230001', '+201012345678');
  w.reg('4230002', '01112345678');
  w.reg('4230003', '01112345678');
  w.reg('4230004', '01512345678');
  w.import('01012345678\n01112345678\n01212345678');
  const r = w.list();
  const by = Object.fromEntries(r.requests.map((x) => [x.phone, x]));
  assert.equal(by['01012345678'].status, 'matched');
  assert.equal(by['01012345678'].matches.length, 1);
  assert.equal(by['01112345678'].status, 'duplicate');
  assert.equal(by['01112345678'].matches.length, 2);
  assert.equal(by['01212345678'].status, 'none');
  assert.equal(r.notRequested.length, 1);
  const unmatched = r.submissions.find((s) => s.id === r.notRequested[0]);
  assert.equal(unmatched.code, '4230004');
});

test('Review: the second step needs the first, and rejecting resets later approvals', () => {
  const w = boot();
  w.reg('4230001', '01012345678');
  const id = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0].id;
  const set = (review) => w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: id, patch: { review } });
  const get = () => w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0];
  assert.equal(set({ group: 'approved' }).error.code, 'review_order');
  assert.equal(set({ schedule: 'approved' }).ok, true);
  assert.equal(get().status, 'in_review');
  assert.equal(set({ group: 'approved' }).ok, true);
  assert.equal(get().status, 'approved');
  set({ schedule: 'rejected' });
  assert.deepEqual(JSON.parse(JSON.stringify(get().review)), { schedule: 'rejected', group: 'pending' });
  assert.equal(get().status, 'rejected');
  assert.equal(set({ nonsense: 'approved' }).error.code, 'bad_step');
  assert.equal(set({ schedule: 'maybe' }).error.code, 'bad_status');
});

test('Decide: approving a matched request completes the group step on the registration', () => {
  const w = boot();
  w.reg('4230001', '01012345678');
  w.import('01012345678');
  const id = w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0].id;
  const q = w.list().requests[0];

  const early = w.admin({ action: 'admin.matching.decide', slug: w.form.slug, requestId: q.id, decision: 'approved' });
  assert.equal(early.error.code, 'review_order');

  w.admin({ action: 'admin.submission.update', slug: w.form.slug, submissionId: id, patch: { review: { schedule: 'approved' } } });
  const ok = w.admin({ action: 'admin.matching.decide', slug: w.form.slug, requestId: q.id, decision: 'approved', note: 'Looks right' });
  assert.equal(ok.submissionId, id);
  const after = w.list();
  assert.equal(after.requests[0].decision, 'approved');
  assert.equal(after.requests[0].note, 'Looks right');
  const sub = after.submissions[0];
  assert.equal(sub.status, 'approved');
  assert.equal(w.sheet(w.form.sheetId, 'Registrations').rows()[1][7], 'Timetable check: approved  |  Group match: approved');
});

test('Decide: requests without exactly one match are decided without touching registrations', () => {
  const w = boot();
  w.import('01212345678');
  const q = w.list().requests[0];
  const r = w.admin({ action: 'admin.matching.decide', slug: w.form.slug, requestId: q.id, decision: 'rejected' });
  assert.equal(r.submissionId, null);
  assert.equal(w.list().requests[0].decision, 'rejected');
  assert.equal(w.admin({ action: 'admin.matching.decide', slug: w.form.slug, requestId: 'missing', decision: 'approved' }).error.code, 'request_not_found');
});

test('Remove: deleted requests disappear; other form types have no matching', () => {
  const w = boot();
  w.import('01012345678\n01112345678');
  const ids = w.list().requests.map((r) => r.id);
  assert.equal(w.admin({ action: 'admin.matching.remove', slug: w.form.slug, requestIds: [ids[0]] }).removed, 1);
  assert.equal(w.list().requests.length, 1);
  const team = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'T', term: '' }).form;
  assert.equal(w.admin({ action: 'admin.matching.list', slug: team.slug }).error.code, 'no_matching');
});
