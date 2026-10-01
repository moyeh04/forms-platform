const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const sized = (d) => ({ team_size: String((d.members || []).length + 1), ...d });
const person = (o) => sized({
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
  level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', ...o
});

function boot(type, patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type, title: 'Seminar Booking', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open', ...patch } });
  w.form = form;
  w.view = (name) => w.sheet(form.sheetId, name);
  return w;
}

const slots = { days: [{ label: 'Week 11 - Sunday', date: '2027-11-14', times: ['12:30 - 12:50', '12:55 - 1:15', '1:20 - 1:40'] }], capacity: 1 };

test('Print reservations: one tab per day, in timetable order, with a signature column', () => {
  const w = boot('reservation', { slots });
  const book = (code, time, title) => w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: code, title, slot: { day: 'week-11-sunday', time } }) });
  book('4230002', '1:20 - 1:40', 'Second');
  book('4230001', '12:30 - 12:50', 'First');
  const r = w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'week-11-sunday' });
  assert.equal(r.count, 2);
  assert.equal(r.sheetName, 'Print - Week 11 - Sunday');
  assert.ok(r.sheetUrl.includes('#gid='));
  const rows = w.view(r.sheetName).rows();
  assert.equal(rows[0][0], 'Seminar Booking  -  Week 11 - Sunday  (2027-11-14)');
  assert.deepEqual(rows[2], ['No.', 'Time', 'Team leader', 'Code', 'Project', 'Signature']);
  assert.deepEqual(rows.slice(3).map((x) => [x[0], x[1], x[4]]), [[1, '12:30 - 12:50', 'First'], [2, '1:20 - 1:40', 'Second']]);
});

test('Print reservations: can include the empty slots', () => {
  const w = boot('reservation', { slots });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'First', slot: { day: 'week-11-sunday', time: '12:55 - 1:15' } }) });
  const r = w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'week-11-sunday', includeEmpty: true });
  assert.equal(r.count, 3);
  assert.equal(w.view(r.sheetName).rows()[3][2], '');
});

test('Print reservations: rejects unknown days and wrong form types', () => {
  const w = boot('reservation', { slots });
  assert.equal(w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'nope' }).error.code, 'day_not_found');
  const t = boot('team_registration');
  assert.equal(t.admin({ action: 'admin.print.reservations', slug: t.form.slug, dayId: 'x' }).error.code, 'wrong_type');
  assert.equal(w.admin({ action: 'admin.print.teamList', slug: w.form.slug }).error.code, 'wrong_type');
});

test('Print team list: numbered teams, members, and a merged project', () => {
  const w = boot('team_registration');
  const m = (name, code) => ({ name, phone: '01112345678', code, level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Alpha', members: [m('سارة خالد حسن علي', '4230002')] }) });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: '4230010', title: 'Beta', members: [] }) });
  const r = w.admin({ action: 'admin.print.teamList', slug: w.form.slug });
  assert.equal(r.count, 2);
  const rows = w.view('Print - Team list').rows();
  assert.deepEqual(rows[2], ['Team', 'Team member name', 'Code', 'Project']);
  assert.equal(rows[3][0], 1);
  assert.equal(rows[3][3], 'Alpha');
  assert.equal(rows[5][0], 2);
  assert.equal(rows[5][3], 'Beta');
});

test('PDF export: returns a Drive link when Google answers, null when it refuses', () => {
  const w = boot('reservation', { slots });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'First', slot: { day: 'week-11-sunday', time: '12:30 - 12:50' } }) });
  let url = '';
  w.fetch = (u, opts) => { url = u; assert.equal(opts.headers.Authorization, 'Bearer test-token'); return { getResponseCode: () => 200, getBlob: () => ({ setName(n) { this.name = n; return this; } }) }; };
  const ok = w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'week-11-sunday' });
  assert.ok(ok.pdfUrl.startsWith('https://drive.google.com/file/d/'));
  assert.ok(url.includes('format=pdf') && url.includes('fitw=true'));
  w.fetch = () => ({ getResponseCode: () => 403, getBlob: () => null });
  assert.equal(w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'week-11-sunday' }).pdfUrl, null);
  w.fetch = null;
  const none = w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'week-11-sunday' });
  assert.equal(none.pdfUrl, null);
  assert.equal(none.count, 1);
});

test('Menu: print dialogs list the right forms and days and escape titles', () => {
  const w = boot('reservation', { slots });
  w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'A <b>team</b> form', term: '' });
  const opts = w.call('menuPrintOptions', 'reservations');
  assert.equal(opts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(opts[0].days)), [{ id: 'week-11-sunday', label: 'Week 11 - Sunday' }]);
  const teams = w.call('menuPrintOptions', 'teams');
  assert.equal(teams.length, 1);
  const html = w.call('printDialogHtml_', 'teams');
  assert.ok(html.includes('A &lt;b&gt;team&lt;/b&gt; form'));
  assert.equal(html.includes('<b>team</b>'), false);
});

test('Menu: menuPrint creates the tab from the dialog call', () => {
  const w = boot('reservation', { slots });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'First', slot: { day: 'week-11-sunday', time: '12:30 - 12:50' } }) });
  const r = w.call('menuPrint', 'reservations', w.form.slug, 'week-11-sunday', false);
  assert.equal(r.count, 1);
});
