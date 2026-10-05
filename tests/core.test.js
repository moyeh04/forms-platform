const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  return w;
}

test('Setup: creates registry tabs, default lists, and is safe to repeat', () => {
  const w = boot();
  w.call('setup');
  const names = w.registry.getSheets().map((s) => s.getName());
  assert.deepEqual(names.sort(), ['Clients', 'Forms', 'Lists']);
  const lists = w.admin({ action: 'admin.lists.get' }).lists;
  assert.equal(lists.levels.length, 5);
  assert.equal(lists.sections.length, 14);
  assert.equal(lists.wa_sections.length, 33);
  assert.equal(w.registry.getSheetByName('Lists').getLastRow(), 7);
  assert.equal(w.triggers.filter((t) => t === 'processDirtyViews').length, 1);
});

test('Admin: wrong PIN is rejected and repeated guesses lock out', () => {
  const w = boot();
  assert.equal(w.api({ action: 'admin.login', admin: { pin: '4321' } }).ok, true);
  for (let i = 0; i < 8; i++) assert.equal(w.api({ action: 'admin.login', admin: { pin: '0000' } }).error.code, 'bad_pin');
  assert.equal(w.api({ action: 'admin.login', admin: { pin: '4321' } }).error.code, 'locked');
  w.advanceDays(1);
  assert.equal(w.api({ action: 'admin.login', admin: { pin: '4321' } }).ok, true);
});

test('Admin: actions need the PIN and PIN must be long enough', () => {
  const w = boot();
  assert.equal(w.api({ action: 'admin.forms.list' }).error.code, 'bad_pin');
  assert.throws(() => w.call('setAdminPin', '12'), /at least 4/);
});

test('Forms: every template can be created and gets its own spreadsheet', () => {
  const w = boot();
  const types = ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'];
  const sheets = new Set();
  types.forEach((type) => {
    const r = w.admin({ action: 'admin.forms.create', type, title: 'Database Team Project', term: 'Fall 2027' });
    assert.equal(r.ok, true, type);
    assert.equal(r.form.status, 'draft');
    assert.ok(r.form.fields.length >= 6);
    sheets.add(r.form.sheetId);
    const header = w.sheet(r.form.sheetId, 'Responses').getRange(1, 1, 1, 3).getValues()[0];
    assert.deepEqual(header, ['id', 'ref', 'created']);
  });
  assert.equal(sheets.size, 4);
  const slugs = w.admin({ action: 'admin.forms.list' }).forms.map((f) => f.slug);
  assert.equal(new Set(slugs).size, 4);
  assert.equal(slugs[0], 'database-team-project-fall-2027');
});

test('Forms: creation validates type and title', () => {
  const w = boot();
  assert.equal(w.admin({ action: 'admin.forms.create', type: 'nope', title: 'x' }).error.code, 'unknown_type');
  assert.equal(w.admin({ action: 'admin.forms.create', type: 'reservation', title: '  ' }).error.code, 'title_required');
});

test('Public form: draft hides fields, open form hides internals and resolves lists', () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Team', term: 'Fall 2027' }).form;
  const draft = w.api({ action: 'getForm', slug: f.slug });
  assert.equal(draft.state, 'draft');
  assert.equal(draft.form.fields, undefined);

  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open' } });
  const open = w.api({ action: 'getForm', slug: f.slug });
  assert.equal(open.state, 'open');
  const level = open.form.fields.find((x) => x.id === 'level');
  assert.equal(level.options.length, 5);
  const memberLevel = open.form.fields.find((x) => x.id === 'members').fields.find((x) => x.id === 'level');
  assert.equal(memberLevel.options.length, 5);
  assert.equal(JSON.stringify(open).includes(f.sheetId), false);
  assert.equal(open.form.sheetId, undefined);
  assert.equal(open.form.notifications, undefined);
});

test('Public form: respects open and close dates', () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Team', term: '' }).form;
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', opensAt: '2027-09-10T00:00:00Z', closesAt: '2027-09-20T00:00:00Z' } });
  assert.equal(w.api({ action: 'getForm', slug: f.slug }).state, 'not_yet');
  w.setNow('2027-09-15T00:00:00Z');
  assert.equal(w.api({ action: 'getForm', slug: f.slug }).state, 'open');
  w.setNow('2027-09-21T00:00:00Z');
  assert.equal(w.api({ action: 'getForm', slug: f.slug }).state, 'closed');
});

test('Forms: updates validate status and keep link names unique', () => {
  const w = boot();
  const a = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'A', term: '' }).form;
  const b = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'B', term: '' }).form;
  assert.equal(w.admin({ action: 'admin.forms.update', id: a.id, patch: { status: 'weird' } }).error.code, 'bad_status');
  assert.equal(w.admin({ action: 'admin.forms.update', id: b.id, patch: { slug: a.slug } }).error.code, 'slug_taken');
  assert.equal(w.admin({ action: 'admin.forms.update', id: b.id, patch: { slug: 'Seminar Booking' } }).form.slug, 'seminar-booking');
});

test('Forms: duplicating gives a draft copy with a fresh sheet and settings kept', () => {
  const w = boot();
  const a = w.admin({ action: 'admin.forms.create', type: 'task_submission', title: 'Projects', term: 'Round 1' }).form;
  w.admin({ action: 'admin.forms.update', id: a.id, patch: { status: 'open', editKey: { enabled: true, days: 3, allowEdit: true, allowDelete: false } } });
  const copy = w.admin({ action: 'admin.forms.duplicate', id: a.id, term: 'Round 2' }).form;
  assert.equal(copy.status, 'draft');
  assert.equal(copy.term, 'Round 2');
  assert.notEqual(copy.sheetId, a.sheetId);
  assert.notEqual(copy.slug, a.slug);
  assert.equal(copy.editKey.days, 3);
});

test('WhatsApp metadata: duplicating a legacy record keeps only batch-year metadata', () => {
  const w = boot();
  const source = w.admin({ action: 'admin.forms.create', type: 'whatsapp_registration', title: 'Groups', term: 'Spring 2027', subject: 'CMPn123' }).form;
  const sheet = w.registry.getSheetByName('Forms');
  const config = JSON.parse(sheet.rows()[1][10]);
  delete config.batchYear;
  config.subject = 'CMPn123';
  sheet.getRange(2, 11).setValue(JSON.stringify(config));
  sheet.getRange(2, 5).setValue('Spring 2027');

  const copy = w.admin({ action: 'admin.forms.duplicate', id: source.id, title: 'Groups 2028', batchYear: '2028/2029' }).form;
  assert.equal(copy.batchYear, '2028/2029');
  assert.equal(copy.term, '');
  assert.equal(copy.subject, undefined);
  const persisted = JSON.parse(sheet.rows()[2][10]);
  assert.equal(persisted.batchYear, '2028/2029');
  assert.equal(persisted.term, undefined);
  assert.equal(persisted.subject, undefined);
});

test('Lists: admins can replace a list and options follow', () => {
  const w = boot();
  w.admin({ action: 'admin.lists.set', key: 'sections', values: ['S1', 'S2'] });
  const f = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'T', term: '' }).form;
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open' } });
  const sec = w.api({ action: 'getForm', slug: f.slug }).form.fields.find((x) => x.id === 'section');
  assert.deepEqual(sec.options.map((o) => o.value), ['S1', 'S2']);
});

test('Router: unknown actions and bad JSON return clean errors', () => {
  const w = boot();
  assert.equal(w.api({ action: 'nope' }).error.code, 'unknown_action');
  const out = w.ctx.doPost({ postData: { contents: '{bad' } });
  assert.equal(JSON.parse(out.getContent()).error.code, 'bad_json');
  assert.equal(w.api({ action: 'getForm', slug: 'missing' }).error.code, 'form_not_found');
});

test('Forms: deleting needs the link name, removes the form, trashes its sheet, and unlists it from links', () => {
  const w = boot();
  const a = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Keep me', term: 'Fall 2027' }).form;
  const b = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Delete me', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.clients.create', name: 'Dr. X', forms: [a.slug, b.slug], hiddenColumns: [], canReview: false });
  assert.equal(w.admin({ action: 'admin.forms.delete', id: b.id }).error.code, 'confirm_required');
  assert.equal(w.api({ action: 'admin.forms.delete', id: b.id, confirm: b.slug }).ok, false, 'needs the PIN');
  const r = w.admin({ action: 'admin.forms.delete', id: b.id, confirm: b.slug });
  assert.equal(r.deleted, true);
  assert.equal(r.sheetTrashed, true);
  assert.ok(w.drive.trashed.has(b.sheetId), 'the sheet is in the Drive trash, not destroyed');
  assert.deepEqual(w.admin({ action: 'admin.forms.list' }).forms.map((f) => f.slug), [a.slug], 'the other form is untouched');
  assert.equal(w.api({ action: 'getForm', slug: b.slug }).error.code, 'form_not_found', 'the link stops working');
  assert.deepEqual(w.admin({ action: 'admin.clients.list' }).clients[0].forms, [a.slug]);
});
