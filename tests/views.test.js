const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot(type, patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type, title: 'Views', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open', ...patch } });
  w.form = form;
  w.view = (name) => w.sheet(form.sheetId, name);
  return w;
}

const member = (name, code) => ({ name, phone: '01112345678', code, level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });
const sized = (d) => ({ team_size: String((d.members || []).length + 1), ...d });
const person = (o) => sized({
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
  level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', ...o
});

test('Team list: every team is a block with its members, star on the leader, merged linked task', () => {
  const w = boot('task_submission');
  const link = (c) => `https://docs.google.com/presentation/d/${ID(c)}/edit`;
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Normalization', link: link('a'), members: [member('سارة خالد حسن علي', '4230002')] }) });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: '4230010', leader_name: 'عمر يوسف إبراهيم سعيد', title: 'ER Diagram', link: link('b'), members: [member('منى أشرف كمال فؤاد', '4230011'), member('كريم هشام عادل نصر', '4230012')] }) });

  const rows = w.view('Team Members List').rows();
  assert.deepEqual(rows[0], ['Team member name', 'Section', 'Code', 'Task']);
  assert.equal(rows.length, 6);
  assert.equal(rows[1][0], '1.  أحمد محمد محمود أحمد  \u2605');
  assert.equal(rows[1][1], '4C-TH1');
  assert.equal(rows[2][0], '2.  سارة خالد حسن علي');
  assert.equal(rows[2][1], '4C-TH1');
  assert.equal(rows[2][2], '4230002');
  assert.equal(rows[3][0], '1.  عمر يوسف إبراهيم سعيد  \u2605');
  assert.equal(rows[5][0], '3.  كريم هشام عادل نصر');
  assert.equal(rows[1][3], `=HYPERLINK("${link('a')}","Normalization")`);
  assert.equal(rows[2][3], '', 'merged cell body stays empty');
  assert.equal(rows[3][3], `=HYPERLINK("${link('b')}","ER Diagram")`);
});

test('Team list: projects without a link show plain text and the header says Project', () => {
  const w = boot('team_registration');
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Library System', members: [] }) });
  const rows = w.view('Team Members List').rows();
  assert.equal(rows[0][3], 'Project');
  assert.equal(rows[1][3], 'Library System');
});

test('Team list: deleted teams disappear and an empty form says so', () => {
  const w = boot('team_registration');
  const r = w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Library System', members: [] }) });
  w.api({ action: 'remove', slug: w.form.slug, key: r.key });
  assert.equal(w.view('Team Members List').rows()[1][0], 'No registrations yet.');
});

test('Bookings: grouped by day, ordered by timetable, day label on the first row of each block', () => {
  const w = boot('reservation', {
    slots: { days: [{ label: 'Week 11 - Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }, { label: 'Week 11 - Tuesday', times: ['12:30 - 12:50'] }], capacity: 1 }
  });
  const book = (code, day, time, title) => w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: code, title, slot: { day, time } }) });
  book('4230003', 'week-11-tuesday', '12:30 - 12:50', 'Third');
  book('4230002', 'week-11-sunday', '12:55 - 1:15', 'Second');
  book('4230001', 'week-11-sunday', '12:30 - 12:50', 'First');
  const rows = w.view('Bookings').rows();
  assert.deepEqual(rows[0], ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project']);
  assert.deepEqual(rows.slice(1).map((r) => r[5]), ['First', 'Second', 'Third']);
  assert.equal(rows[1][0], 'Week 11 - Sunday');
  assert.equal(rows[2][0], '');
  assert.equal(rows[3][0], 'Week 11 - Tuesday');
});

test('Bookings: teammate names appear in the sheet view only when collection is enabled', () => {
  const w = boot('reservation', {
    slots: { days: [{ label: 'Sunday', times: ['12:30 - 12:50'] }], capacity: 2 }
  });
  const form = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: {
    fields: form.fields.map((field) => field.role === 'members' ? { ...field, enabled: true } : field),
    steps: form.steps.map((step) => step.id === 'project' ? { ...step, fields: step.fields.concat('members') } : step)
  } });
  const name = 'سارة خالد حسن علي';
  const result = w.api({ action: 'submit', slug: w.form.slug, data: person({
    title: 'Seminar project', slot: { day: 'sunday', time: '12:30 - 12:50' }, members: [member(name, '4230002')]
  }) });
  assert.equal(result.ok, true);
  const rows = w.view('Bookings').rows();
  assert.deepEqual(rows[0], ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project', 'Teammates']);
  assert.equal(rows[1][6], name);
});

test('Bookings: legacy reservations gain disabled teammate metadata before views and printing', () => {
  const w = boot('reservation', {
    slots: { days: [{ id: 'sunday', label: 'Sunday', times: ['12:30 - 12:50'] }], capacity: 1 }
  });
  w.api({ action: 'submit', slug: w.form.slug, data: person({
    title: 'Solo project', slot: { day: 'sunday', time: '12:30 - 12:50' }
  }) });

  const forms = w.registry.getSheetByName('Forms');
  const config = JSON.parse(forms.rows()[1][10]);
  config.fields = config.fields.filter((field) => field.role !== 'members');
  config.steps = config.steps.map((step) => ({ ...step, fields: step.fields.filter((id) => id !== 'members') }));
  forms.getRange(2, 11).setValue(JSON.stringify(config));

  const legacy = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  const members = legacy.fields.find((field) => field.role === 'members');
  assert.ok(members, 'legacy reservation receives the teammate field definition');
  assert.equal(members.enabled, false, 'legacy reservations remain solo-only');
  assert.ok(legacy.steps.find((step) => step.id === 'project').fields.includes(members.id));

  w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.deepEqual(w.view('Bookings').rows()[0], ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project']);
  const printed = w.admin({ action: 'admin.print.reservations', slug: w.form.slug, dayId: 'sunday' });
  assert.deepEqual(w.view(printed.sheetName).rows()[2], ['No.', 'Time', 'Team leader', 'Code', 'Project', 'Signature']);
});

test('Registrations: WhatsApp rows sorted by group and section with review text and link', () => {
  const w = boot('whatsapp_registration');
  const reg = (code, group, section, phone) => w.api({
    action: 'submit', slug: w.form.slug,
    data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone, code, level: 'صفر / الأولى', major: 'حاسبات', group, section, schedule: `https://drive.google.com/file/d/${ID('s')}/view` }
  });
  reg('4230001', 'B', '3', '01012345671');
  reg('4230002', 'A', '21', '01012345672');
  reg('4230003', 'A', '4', '01012345673');
  const rows = w.view('Registrations').rows();
  assert.deepEqual(rows.slice(1).map((r) => r[2]), ['4230003', '4230002', '4230001']);
  assert.equal(rows[1][7], 'Timetable check: pending  |  Group match: pending');
  assert.ok(rows[1][6].startsWith('=HYPERLINK('));
});

test('Large forms: rebuild is deferred to the timer and then catches up', () => {
  const w = boot('team_registration');
  vm.runInContext('VIEW_INLINE_LIMIT = 1', w.ctx);
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'One', members: [] }) });
  w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: '4230099', title: 'Two', members: [] }) });
  assert.equal(w.view('Team Members List').rows().length, 2, 'only the first team is in the view so far');
  assert.ok([...w.props.keys()].some((k) => k.startsWith('dirty:')));
  w.call('processDirtyViews');
  assert.equal(w.view('Team Members List').rows().length, 3);
  assert.equal([...w.props.keys()].some((k) => k.startsWith('dirty:')), false);
});

test('Admin: rebuild on demand returns the sheet link', () => {
  const w = boot('team_registration');
  const r = w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.equal(r.rebuilt, true);
  assert.ok(r.sheetUrl.includes(w.form.sheetId));
});
