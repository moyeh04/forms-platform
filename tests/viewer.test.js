const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld({ now: Date.parse('2027-11-14T09:00:00Z') });
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const mk = (type, title, patch = {}) => {
    const f = w.admin({ action: 'admin.forms.create', type, title, term: 'Fall 2027' }).form;
    w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', ...patch } });
    return f;
  };
  w.res = mk('reservation', 'Seminar', {
    slots: { days: [{ label: 'Week 11 - Sunday', date: '2027-11-14', times: ['12:30 - 12:50', '12:55 - 1:15'] }, { label: 'Week 11 - Tuesday', date: '2027-11-16', times: ['12:30 - 12:50'] }], capacity: 1 }
  });
  w.team = mk('task_submission', 'Tasks');
  w.wa = mk('whatsapp_registration', 'Group A and B');
  const sized = (d) => ({ team_size: String((d.members || []).length + 1), ...d });
  const person = (o) => sized({ email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات', level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', ...o });
  const book = (code, day, time, title) => w.api({ action: 'submit', slug: w.res.slug, data: person({ leader_code: code, title, slot: { day, time } }) });
  book('4230001', 'week-11-sunday', '12:55 - 1:15', 'Second');
  book('4230002', 'week-11-sunday', '12:30 - 12:50', 'First');
  book('4230003', 'week-11-tuesday', '12:30 - 12:50', 'Later');
  w.api({
    action: 'submit', slug: w.team.slug,
    data: person({ title: 'Normalization', link: `https://docs.google.com/presentation/d/${ID('a')}/edit`, members: [{ name: 'سارة خالد حسن علي', phone: '01112345678', code: '4230009', level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' }] })
  });
  w.api({
    action: 'submit', slug: w.wa.slug,
    data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230001', level: 'صفر / الأولى', major: 'حاسبات', group: 'A', section: '21', schedule: `https://drive.google.com/file/d/${ID('w')}/view` }
  });
  w.client = (o = {}) => w.admin({ action: 'admin.clients.create', name: 'Dr. Hassan', forms: [w.res.slug], ...o });
  w.data = (token, slug, extra = {}) => w.api({ action: 'viewer.data', token, slug, ...extra });
  return w;
}

test('Clients: a link is created once, the token itself is never stored', () => {
  const w = boot();
  const c = w.client();
  assert.match(c.token, /^[0-9a-f]{24}$/);
  const row = w.registry.getSheetByName('Clients').rows()[1];
  assert.equal(row.join('|').includes(c.token), false);
  assert.equal(w.admin({ action: 'admin.clients.list' }).clients[0].tokenHash, undefined);
  assert.equal(w.admin({ action: 'admin.clients.create', name: ' ' }).error.code, 'name_required');
  assert.equal(w.admin({ action: 'admin.clients.create', name: 'X', forms: ['missing'] }).error.code, 'form_not_found');
});

test('Viewer: lists only the forms the link allows, never drafts', () => {
  const w = boot();
  const draft = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Draft one', term: '' }).form;
  const one = w.client();
  const names = w.api({ action: 'viewer.me', token: one.token }).forms.map((f) => f.slug);
  assert.deepEqual(names, [w.res.slug]);
  const all = w.client({ name: 'Everything', forms: ['*'] });
  const slugs = w.api({ action: 'viewer.me', token: all.token }).forms.map((f) => f.slug);
  assert.equal(slugs.length, 3);
  assert.equal(slugs.includes(draft.slug), false);
});

test('Viewer: unknown, revoked, and regenerated links stop working', () => {
  const w = boot();
  const c = w.client();
  assert.equal(w.api({ action: 'viewer.me', token: 'nope' }).error.code, 'bad_token');
  w.admin({ action: 'admin.clients.update', id: c.client.id, patch: { active: false } });
  assert.equal(w.api({ action: 'viewer.me', token: c.token }).error.code, 'revoked');
  const fresh = w.admin({ action: 'admin.clients.regenerate', id: c.client.id });
  assert.equal(w.api({ action: 'viewer.me', token: c.token }).error.code, 'bad_token');
  assert.equal(w.api({ action: 'viewer.me', token: fresh.token }).ok, true);
  assert.equal(w.admin({ action: 'admin.clients.remove', id: c.client.id }).removed, true);
  assert.equal(w.api({ action: 'viewer.me', token: fresh.token }).error.code, 'bad_token');
});

test('Viewer: a link cannot open a form it was not given', () => {
  const w = boot();
  const c = w.client();
  assert.equal(w.data(c.token, w.team.slug).error.code, 'forbidden');
});

test('Reservations: teammate names appear only when collecting teammates', () => {
  const w = boot();
  const client = w.client();
  const hidden = w.data(client.token, w.res.slug, { mode: 'all' });
  assert.equal(hidden.columns.some((column) => column.id === 'members'), false);

  const form = w.admin({ action: 'admin.forms.get', id: w.res.id }).form;
  form.slots.capacity = 2;
  w.admin({ action: 'admin.forms.update', id: w.res.id, patch: {
    slots: form.slots,
    fields: form.fields.map((field) => field.role === 'members' ? { ...field, enabled: true, required: true } : field)
  } });
  w.api({ action: 'submit', slug: w.res.slug, data: {
    email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230010', phone: '01012345678', major: 'حاسبات',
    level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Team project',
    slot: { day: 'week-11-sunday', time: '12:30 - 12:50' },
    members: [{ name: 'سارة خالد حسن علي', phone: '01112345678', code: '4230011', level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' }]
  } });
  const visible = w.data(client.token, w.res.slug, { mode: 'all' });
  assert.equal(visible.columns.some((column) => column.id === 'members'), true);
  assert.ok(visible.rows.some((row) => row.members === 'سارة خالد حسن علي'));

  w.admin({ action: 'admin.forms.update', id: w.res.id, patch: {
    fields: form.fields.map((field) => field.role === 'members' ? { ...field, enabled: false } : field)
  } });
  const disabled = w.data(client.token, w.res.slug, { mode: 'all' });
  assert.equal(disabled.columns.some((column) => column.id === 'members'), false);
  assert.equal(JSON.stringify(disabled).includes('سارة خالد حسن علي'), false);
});

test('Reservations: today, by day, and all, in timetable order', () => {
  const w = boot();
  const c = w.client();
  const titles = (r) => r.rows.map((x) => x.title);
  assert.deepEqual(titles(w.data(c.token, w.res.slug, { mode: 'all' })), ['First', 'Second', 'Later']);
  assert.deepEqual(titles(w.data(c.token, w.res.slug, { mode: 'today' })), ['First', 'Second']);
  assert.deepEqual(titles(w.data(c.token, w.res.slug, { mode: 'day', dayId: 'week-11-tuesday' })), ['Later']);
  w.setNow('2027-11-16T09:00:00Z');
  assert.deepEqual(titles(w.data(c.token, w.res.slug, { mode: 'today' })), ['Later']);
  const r = w.data(c.token, w.res.slug);
  assert.equal(r.days.length, 2);
  assert.equal(r.today, '2027-11-16');
});

test('Hidden columns are removed on the server, not just in the page', () => {
  const w = boot();
  const c = w.client({ hiddenColumns: ['phone', 'email'] });
  const r = w.data(c.token, w.res.slug);
  assert.equal(r.columns.some((x) => x.id === 'phone'), false);
  const text = JSON.stringify(r);
  assert.equal(text.includes('01012345678'), false);
  assert.equal(text.includes('a@b.com'), false);
  assert.ok(text.includes('4230002'));
});

test('Teams: groups with members, linked task, and hidden phone', () => {
  const w = boot();
  const c = w.client({ forms: [w.team.slug], hiddenColumns: ['phone'] });
  const r = w.data(c.token, w.team.slug);
  assert.equal(r.kind, 'team');
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].title, 'Normalization');
  assert.equal(r.groups[0].members.length, 2);
  assert.equal(r.groups[0].members[0].leader, true);
  assert.equal(JSON.stringify(r).includes('01112345678'), false);
});

test('Review: only links that may review can change a step', () => {
  const w = boot();
  const readonly = w.client({ forms: [w.wa.slug] });
  const rows = w.data(readonly.token, w.wa.slug).rows;
  const call = (token, status) => w.api({ action: 'viewer.review', token, slug: w.wa.slug, submissionId: rows[0].id, stepId: 'schedule', status });
  assert.equal(call(readonly.token, 'approved').error.code, 'forbidden');
  const reviewer = w.client({ name: 'TA', forms: [w.wa.slug], canReview: true });
  assert.equal(call(reviewer.token, 'approved').ok, true);
  assert.equal(w.data(reviewer.token, w.wa.slug).rows[0].review.schedule, 'approved');
  assert.equal(w.data(reviewer.token, w.wa.slug).steps.length, 2);
});

test('Viewer: repeated bad tokens are throttled', () => {
  const w = boot();
  for (let i = 0; i < 30; i++) w.api({ action: 'viewer.me', token: 'x' + i });
  assert.equal(w.api({ action: 'viewer.me', token: 'again' }).error.code, 'too_many_attempts');
});
