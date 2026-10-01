const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot(type = 'task_submission') {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.form = w.admin({ action: 'admin.forms.create', type, title: 'Tasks', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { status: 'open' } });
  return w;
}

const person = (o) => ({
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
  level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', team_size: '1', members: [], ...o
});

test('Export: every team with members, leader first, and its task link, oldest first', () => {
  const w = boot();
  const link = (c) => `https://docs.google.com/presentation/d/${ID(c)}/edit`;
  const m = { name: 'سارة خالد حسن علي', phone: '01112345678', code: '4230002', level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' };
  w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Alpha', link: link('a'), team_size: '2', members: [m] }) });
  w.setNow(w.nowMs + 60000);
  w.api({ action: 'submit', slug: w.form.slug, data: person({ leader_code: '4230010', title: 'Beta', link: link('b') }) });
  const r = w.admin({ action: 'admin.export.tasks', slug: w.form.slug });
  assert.equal(r.ok, true);
  assert.equal(r.form.title, 'Tasks');
  assert.deepEqual(r.teams.map((t) => t.title), ['Alpha', 'Beta']);
  assert.deepEqual(r.teams[0].members.map((x) => [x.code, x.leader]), [['4230001', true], ['4230002', false]]);
  assert.equal(r.teams[0].link, link('a'));
  assert.equal(JSON.stringify(r).includes('keyHash'), false);
  assert.equal(JSON.stringify(r).includes('01012345678'), false, 'no phone numbers are exported');
});

test('Export: needs the admin PIN and a team or task form', () => {
  const w = boot();
  assert.equal(w.api({ action: 'admin.export.tasks', slug: w.form.slug }).error.code, 'bad_pin');
  const res = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Seminar', term: '' }).form;
  assert.equal(w.admin({ action: 'admin.export.tasks', slug: res.slug }).error.code, 'wrong_type');
});

test('Export: deleted teams are left out', () => {
  const w = boot();
  const a = w.api({ action: 'submit', slug: w.form.slug, data: person({ title: 'Alpha', link: `https://docs.google.com/presentation/d/${ID('a')}/edit` }) });
  w.api({ action: 'remove', slug: w.form.slug, key: a.key });
  assert.equal(w.admin({ action: 'admin.export.tasks', slug: w.form.slug }).teams.length, 0);
});
