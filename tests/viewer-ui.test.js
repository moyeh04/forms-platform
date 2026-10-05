const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');
const { openPage, helpers, settle } = require('./harness/dom.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld({ now: Date.parse('2027-11-14T09:00:00Z') });
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.make = (type, title, patch = {}) => {
    const f = w.admin({ action: 'admin.forms.create', type, title, term: 'Fall 2027' }).form;
    w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', ...patch } });
    return f;
  };
  w.client = (body) => w.admin({ action: 'admin.clients.create', name: 'Dr. Ahmed', forms: ['*'], ...body }).token;
  return w;
}

const person = (o) => ({
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
  level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', ...o
});

async function openViewer(w, token, extra = '') {
  const dom = await openPage('viewer.html', w, { query: `?t=${token}${extra}` });
  await dom.window.App.viewer.start();
  await settle(10);
  return { dom, win: dom.window, ...helpers(dom.window) };
}

const slots = {
  days: [
    { label: 'Week 11 - Sunday', date: '2027-11-14', times: ['12:30 - 12:50', '12:55 - 1:15'] },
    { label: 'Week 11 - Tuesday', date: '2027-11-16', times: ['12:30 - 12:50'] }
  ],
  capacity: 1
};

function bookings(w, f) {
  const book = (code, day, time, title) => w.api({ action: 'submit', slug: f.slug, data: person({ leader_code: code, title, slot: { day, time } }) });
  book('4230001', 'week-11-sunday', '12:55 - 1:15', 'Second');
  book('4230002', 'week-11-sunday', '12:30 - 12:50', 'First');
  book('4230003', 'week-11-tuesday', '12:30 - 12:50', 'Later');
}

test('Instructor link: opens on today, with the columns the admin chose', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar', { slots });
  bookings(w, f);
  const p = await openViewer(w, w.client({ hiddenColumns: ['phone', 'email'] }));
  assert.equal(p.$('h1').textContent, 'Seminar');
  assert.equal(p.$('[data-mode="today"]').getAttribute('aria-pressed'), 'true');
  assert.equal(p.$$('.block').length, 1);
  assert.deepEqual(p.$$('tbody td.mono').filter((c) => /\d:\d\d - /.test(c.textContent)).map((c) => c.textContent), ['12:30 - 12:50', '12:55 - 1:15']);
  const headers = p.$$('thead th').map((t) => t.textContent);
  assert.ok(headers.includes('Team leader') && headers.includes('Code'));
  assert.equal(headers.includes('Phone'), false, 'hidden columns never reach the page');
  assert.equal(p.text().includes('01012345678'), false);
});

test('Instructor link: switch to a day or to everything, and search', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar', { slots });
  bookings(w, f);
  const p = await openViewer(w, w.client());
  p.click('[data-mode="all"]'); await settle(8);
  assert.equal(p.$$('.block').length, 2);
  assert.deepEqual(p.$$('.block').map((b) => b.classList.contains('tint-a') ? 'a' : 'b'), ['a', 'b']);
  p.click('[data-mode="day"]'); await settle(8);
  const sel = p.$$('select').find((s) => [...s.options].some((o) => o.value === 'week-11-tuesday'));
  sel.value = 'week-11-tuesday'; p.fire(sel, 'change'); await settle(8);
  assert.equal(p.$$('.block').length, 1);
  assert.ok(p.text().includes('Later'));
  p.click('[data-mode="all"]'); await settle(8);
  p.type('[name="search"]', 'second');
  assert.equal(p.$$('tbody tr').length, 1);
});

test('Instructor link: a date-less timetable has no Today button and opens on all', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar', { slots: { days: [{ label: 'Week 11 - Sunday', times: ['12:30 - 12:50'] }], capacity: 1 } });
  w.api({ action: 'submit', slug: f.slug, data: person({ title: 'First', slot: { day: 'week-11-sunday', time: '12:30 - 12:50' } }) });
  const p = await openViewer(w, w.client());
  assert.equal(p.$('[data-mode="today"]'), null);
  assert.equal(p.$('[data-mode="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal(p.$$('.block').length, 1);
});

test('Instructor link: teams are tinted blocks with a star and a linked task, and hidden columns vanish', async () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  const link = `https://docs.google.com/presentation/d/${ID('a')}/edit`;
  const m = (name, code) => ({ name, phone: '01112345678', code, level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });
  w.api({ action: 'submit', slug: f.slug, data: person({ team_size: '2', title: 'Alpha', link, members: [m('سارة خالد حسن علي', '4230002')] }) });
  w.api({ action: 'submit', slug: f.slug, data: person({ team_size: '1', leader_code: '4230010', title: 'Beta', link: link.replace('aaa', 'bbb'), members: [] }) });
  const p = await openViewer(w, w.client({ hiddenColumns: ['phone'] }));
  const blocks = p.$$('.block');
  assert.equal(blocks.length, 2);
  assert.ok(blocks[0].classList.contains('tint-a') && blocks[1].classList.contains('tint-b'));
  assert.equal(blocks[0].querySelectorAll('tbody tr').length, 2);
  assert.ok(blocks[0].querySelector('tr.leader .icon-star'));
  assert.equal(blocks[0].querySelector('.block-side a').getAttribute('href'), link);
  assert.ok(blocks[0].querySelectorAll('.mini thead th')[2].textContent.includes('Section'));
  assert.equal(p.text().includes('01112345678'), false);
});

test('Instructor link: WhatsApp metadata shows the batch year without subject or semester', async () => {
  const w = boot();
  const f = w.make('whatsapp_registration', 'Groups', { batchYear: '2029/2030' });
  const page = await openViewer(w, w.client(), `&f=${f.slug}`);
  assert.equal(page.$('h1').textContent, 'Groups');
  assert.deepEqual([...page.$$('.admin-bar .tag-sm')].map((tag) => tag.textContent), ['Batch 2029/2030']);
});

test('Instructor link: reviewers can mark steps, read-only links only see them', async () => {
  const w = boot();
  const f = w.make('whatsapp_registration', 'Groups');
  w.api({ action: 'submit', slug: f.slug, data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230999', level: 'صفر / الأولى', major: 'حاسبات', group: 'A', section: '21', schedule: `https://drive.google.com/file/d/${ID('s')}/view` } });
  const ro = await openViewer(w, w.client());
  assert.equal(ro.$$('tbody select').length, 0);
  assert.ok(ro.text().includes('Timetable check'));

  const rv = await openViewer(w, w.client({ canReview: true }));
  const sel = rv.$('tbody select[aria-label="Timetable check"]');
  sel.value = 'approved'; rv.fire(sel, 'change'); await settle(8);
  assert.equal(w.admin({ action: 'admin.submissions', slug: f.slug }).submissions[0].review.schedule, 'approved');
});

test('Instructor link: invalid, missing, and turned-off links explain themselves', async () => {
  const w = boot();
  w.make('reservation', 'Seminar', { slots });
  const bad = await openViewer(w, 'not-a-real-token');
  assert.ok(bad.text().includes('This link is not valid'));
  const none = await openPage('viewer.html', w, { query: '' });
  await none.window.App.viewer.start(); await settle(4);
  assert.ok(none.window.document.body.textContent.includes('missing its access code'));

  const made = w.admin({ action: 'admin.clients.create', name: 'Temp', forms: ['*'] });
  w.admin({ action: 'admin.clients.update', id: made.client.id, patch: { active: false } });
  const off = await openViewer(w, made.token);
  assert.ok(off.text().includes('turned off'));
});

test('Instructor link: only the forms shared with the client are listed', async () => {
  const w = boot();
  const a = w.make('reservation', 'Seminar A', { slots });
  const b = w.make('reservation', 'Seminar B', { slots });
  const p = await openViewer(w, w.client({ forms: [b.slug] }));
  assert.equal(p.$('h1').textContent, 'Seminar B');
  assert.equal(p.$$('select').some((s) => [...s.options].some((o) => o.value === a.slug)), false);
});
