const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');
const { openPage, helpers, settle } = require('./harness/dom.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.make = (type, title, patch = {}) => {
    const f = w.admin({ action: 'admin.forms.create', type, title, term: 'Fall 2027', batchYear: '2027/2028' }).form;
    w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', ...patch } });
    return f;
  };
  return w;
}

async function openAdmin(w, hash = '', login = true) {
  const dom = await openPage('admin.html', w, { hash });
  const win = dom.window;
  if (login) win.App.api.setPin('4321');
  await win.App.admin.start();
  await settle(10);
  return { dom, win, ...helpers(win) };
}

const person = (o) => ({
  email: 'a@b.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230001', phone: '01012345678', major: 'حاسبات',
  level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', ...o
});
const member = (name, code) => ({ name, phone: '01112345678', code, level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });
const submit = (w, f, d) => w.api({ action: 'submit', slug: f.slug, data: { team_size: String((d.members || []).length + 1), ...d } });

test('Login: a wrong PIN is refused and the right one opens the dashboard', async () => {
  const w = boot();
  const p = await openAdmin(w, '', false);
  assert.ok(p.$('#pin'));
  p.type('#pin', '0000'); p.submitForm(); await settle(8);
  assert.ok(p.$('#pin-err').textContent.includes('not correct'));
  assert.equal(p.$('#pin').value, '0000', 'the refused PIN stays in its field');
  assert.deepEqual([p.$('#pin').selectionStart, p.$('#pin').selectionEnd], [0, 4], 'selected, so typing replaces it');
  p.type('#pin', '4321'); p.submitForm(); await settle(10);
  assert.ok(p.text().includes('No forms yet'));
  assert.equal(p.$('.admin-nav a[aria-current="page"]').textContent, 'Forms');
});

test('Login: a lock after wrong tries elsewhere does not sign an open dashboard out', async () => {
  const w = boot();
  w.make('team_registration', 'Projects');
  for (let i = 0; i < 8; i++) w.api({ action: 'admin.login', admin: { pin: '0000' } });
  const p = await openAdmin(w);
  assert.ok(p.$('.banner').textContent.includes('Too many wrong PINs'), 'the page says to wait');
  assert.equal(p.$('#pin'), null, 'and does not ask for the PIN again');
  assert.equal(p.win.App.api.getPin(), '4321');
  w.call('unlockAdmin');
  await p.win.App.admin.start(); await settle(10);
  assert.ok(p.text().includes('Projects'), 'the same window works once the lock is lifted');
});

test('Forms: the list shows every form with its type, status, and actions', async () => {
  const w = boot();
  w.make('team_registration', 'Projects');
  w.make('reservation', 'Seminar', { status: 'closed' });
  const p = await openAdmin(w);
  const cards = p.$$('.card');
  assert.equal(cards.length, 2);
  assert.ok(p.text().includes('Team registration') && p.text().includes('Reservation'));
  assert.ok(p.$$('.badge').some((b) => b.textContent === 'Closed'));
  assert.ok(cards[0].querySelector('a[href*="index.html?f="]'));
});

test('Create: pick a type, name it, and land on its settings as a draft', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  p.pick('type', 'task_submission');
  p.type('[name="title"]', 'Database Tasks');
  p.click('[name="season-spring"]');
  const year = p.$('[name="termYear"]'); year.value = (new Date().getFullYear() + 1) + '/' + (new Date().getFullYear() + 2); p.fire(year, 'change');
  p.type('[name="subject"]', 'CMP n323');
  p.submitForm(); await settle(12);
  const forms = w.admin({ action: 'admin.forms.list' }).forms;
  assert.equal(forms.length, 1);
  assert.equal(forms[0].type, 'task_submission');
  assert.equal(forms[0].term, 'Spring ' + (new Date().getFullYear() + 1) + '/' + (new Date().getFullYear() + 2), 'season chip plus academic year');
  assert.equal(forms[0].subject, 'CMPn323', 'spaces are removed from the subject code');
  assert.equal(forms[0].status, 'draft');
  assert.ok(p.win.location.hash.endsWith('/settings'));
  assert.ok(p.$('[name="teamMin"]'), 'settings page is showing');
});

test('Create: switching types replaces subject and term metadata with a batch year', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  p.pick('type', 'task_submission');
  p.type('[name="subject"]', 'CMPn323');
  p.click('[name="season-spring"]');
  const termYear = p.$('[name="termYear"]');
  termYear.value = '2028/2029'; p.fire(termYear, 'change');

  p.pick('type', 'whatsapp_registration');
  assert.equal(p.$('[name="subject"]'), null, 'WhatsApp registration does not ask for a subject code');
  assert.equal(p.$('[name="termYear"]'), null, 'WhatsApp registration does not ask for a semester');
  assert.equal(p.$('[name="batchYear"]').value, new Date().getFullYear() + '/' + (new Date().getFullYear() + 1));
  p.pick('batchYear', '2030/2031');

  p.pick('type', 'task_submission');
  assert.equal(p.$('[name="subject"]').value, 'CMPn323', 'switching back restores subject metadata');
  assert.equal(p.$('[name="termYear"]').value, '2028/2029', 'switching back restores term metadata');
  p.pick('type', 'whatsapp_registration');
  assert.equal(p.$('[name="batchYear"]').value, '2030/2031', 'switching types preserves the batch year');

  p.type('[name="title"]', 'Groups 2029');
  p.submitForm(); await settle(12);
  const saved = w.admin({ action: 'admin.forms.list' }).forms[0];
  assert.equal(saved.type, 'whatsapp_registration');
  assert.equal(saved.batchYear, '2030/2031');
  assert.equal(JSON.parse(w.registry.getSheetByName('Forms').rows()[1][10]).batchYear, '2030/2031');
  assert.equal(saved.term, '', 'new WhatsApp forms do not persist a semester');
  assert.equal(saved.subject, undefined, 'new WhatsApp forms do not persist a subject code');
});

test('WhatsApp metadata: settings, public form, and viewer retain and display batch year', async () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'whatsapp_registration', title: 'Groups 2028', batchYear: '2028/2029' }).form;
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open' } });
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="batchYear"]').value, '2028/2029');
  assert.equal(p.$('[name="termYear"]'), null);
  assert.equal(p.$('[name="subject"]'), null);
  p.type('[name="batchYear"]', '2029/2030');
  p.click('[name="save"]'); await settle(12);

  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.batchYear, '2029/2030');
  assert.equal(saved.term, '');
  const settingsReload = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(settingsReload.$('[name="batchYear"]').value, '2029/2030');
  assert.ok(settingsReload.text().includes('Batch 2029/2030'));
  assert.equal(settingsReload.text().includes('Fall 2027'), false);

  const pub = w.api({ action: 'getForm', slug: f.slug }).form;
  assert.equal(pub.batchYear, '2029/2030');
  assert.equal(pub.term, undefined, 'public WhatsApp metadata contains only the batch year');
  const studentPage = await openPage('index.html', w, { query: `?f=${f.slug}` });
  studentPage.window.App.form.init(); await settle();
  assert.equal(studentPage.window.document.querySelector('.tags').textContent.trim(), 'Batch 2029/2030');
  assert.equal(studentPage.window.document.title, 'Groups 2028 - Batch 2029/2030');

  const client = w.admin({ action: 'admin.clients.create', name: 'Dr. Ahmed', forms: [f.slug], withKey: false });
  const viewerMe = w.api({ action: 'viewer.me', token: client.token });
  assert.equal(viewerMe.forms[0].batchYear, '2029/2030');
  assert.equal(viewerMe.forms[0].term, undefined);
  const viewer = w.api({ action: 'viewer.data', token: client.token, slug: f.slug });
  assert.equal(viewer.form.batchYear, '2029/2030');
  assert.equal(viewer.form.term, undefined);
  const viewerPage = await openPage('viewer.html', w, { query: `?t=${client.token}` });
  await viewerPage.window.App.viewer.start(); await settle(8);
  assert.equal(viewerPage.window.document.querySelector('.admin-bar').textContent.includes('Batch 2029/2030'), true);
  assert.equal(viewerPage.window.document.querySelector('.admin-bar').textContent.includes('Fall 2027'), false);

  const cardPage = await openAdmin(w);
  const card = cardPage.$('.card[data-slug="' + f.slug + '"]');
  assert.deepEqual([...card.querySelectorAll('.card-tags .tag-sm')].map((tag) => tag.textContent), ['Batch 2029/2030']);
  const responsesPage = await openAdmin(w, `#/f/${f.slug}`);
  assert.deepEqual([...responsesPage.$$('.page-head .tag-sm')].map((tag) => tag.textContent), ['Batch 2029/2030']);
});

test('WhatsApp metadata: legacy semester records resolve to batch year without displaying old subject metadata', async () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'whatsapp_registration', title: 'Legacy Groups', term: 'Fall 2027', subject: 'CMPn123' }).form;
  const forms = w.registry.getSheetByName('Forms');
  const row = forms.rows()[1];
  const config = JSON.parse(row[10]);
  delete config.batchYear;
  config.subject = 'CMPn123';
  forms.getRange(2, 11).setValue(JSON.stringify(config));
  forms.getRange(2, 5).setValue('Fall 2027');

  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.batchYear, '2027/2028', 'legacy storage is resolved through its metadata adapter');
  assert.equal(JSON.parse(forms.rows()[1][10]).batchYear, undefined, 'the legacy record remains unmodified before save');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="batchYear"]').value, '2027/2028');
  assert.equal(p.$('[name="subject"]'), null);
  assert.ok(p.text().includes('Batch 2027/2028'));
  assert.equal(p.text().includes('CMPn123'), false);

  p.click('[name="save"]'); await settle(12);
  const migrated = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(migrated.batchYear, '2027/2028');
  assert.equal(migrated.term, 'Fall 2027', 'saving does not destroy the legacy value');
  const publicForm = w.api({ action: 'getForm', slug: f.slug }).form;
  assert.equal(publicForm.batchYear, '2027/2028');
  assert.equal(publicForm.subject, undefined);
  assert.equal(publicForm.term, undefined);
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open' } });
  const client = w.admin({ action: 'admin.clients.create', name: 'Dr. Ahmed', forms: [f.slug], withKey: false });
  const view = w.api({ action: 'viewer.data', token: client.token, slug: f.slug });
  assert.equal(view.form.batchYear, '2027/2028');
  assert.equal(view.form.subject, undefined);
  assert.equal(view.form.term, undefined);
});

test('Create: a title is required', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  assert.ok(p.$('#new-title-err').hidden);
  p.submitForm(); await settle(4);
  assert.equal(p.$('#new-title-err').hidden, false, 'the reason is next to the field');
  assert.equal(p.$('#new-title-err').textContent, 'Give the form a title first.');
  assert.equal(p.$('[name="title"]').getAttribute('aria-invalid'), 'true');
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 0);
  p.type('[name="title"]', 'Seminar');
  assert.ok(p.$('#new-title-err').hidden, 'the reason leaves when the title is typed');
});

test('Create: the preview shows the title, the tags and the pages of the chosen kind of form', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  assert.equal(p.$('.new-preview-title').textContent, 'Your title');
  p.type('[name="title"]', 'Project discussion');
  p.type('[name="subject"]', 'CS101');
  assert.equal(p.$('.new-preview-title').textContent, 'Project discussion');
  assert.ok(p.$('.new-preview').textContent.includes('CS101'));
  for (const type of Object.keys(p.win.App.admin.TYPES)) {
    p.pick('type', type);
    const made = w.admin({ action: 'admin.forms.create', type, title: 'T ' + type, term: 'Fall 2027' }).form;
    assert.deepEqual(p.$$('.new-pages li').map((n) => n.textContent), made.steps.map((st) => st.title.en).concat(['Review']), type + ': the preview lists the pages of the template');
  }
});

test('Team size: admin sets the minimum and maximum and students see exactly those choices', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="teamMin"]').value, '1');
  assert.equal(p.$('[name="teamMax"]').value, '6');
  p.type('[name="teamMin"]', '2');
  p.type('[name="teamMax"]', '4');
  assert.ok(p.$('.size-preview').textContent.includes('2') && p.$('.size-preview').textContent.includes('4'));
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize, { min: 2, max: 4 });

  const stu = await openPage('index.html', w, { query: `?f=${f.slug}` });
  stu.window.App.form.init(); await settle();
  const s = helpers(stu.window);
  s.type('[name="email"]', 'a@b.com'); s.type('[name="leader_name"]', 'أحمد محمد محمود أحمد'); s.type('[name="leader_code"]', '4230999'); s.type('[name="phone"]', '01012345678');
  s.submitForm(); await settle();
  s.pick('major', 'حاسبات'); s.pick('level', 'صفر / الأولى'); s.pick('section', '4C-TH1'); s.pick('curriculum', '2020');
  s.submitForm(); await settle();
  assert.deepEqual(s.$$('.size-chips input').map((i) => i.value), ['2', '3', '4']);
});

test('Setup: a save over a newer change is refused, and the reason and what was typed stay', async () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  // Another window closes the form after this page was opened.
  w.advanceDays(0.001);
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'closed' } });
  p.type('[name="title"]', 'Typed here');
  p.click('[name="save"]'); await settle(8);
  const note = p.$('.savebar-note');
  assert.match(note.textContent, /changed in another window/);
  assert.equal(note.getAttribute('role'), 'alert');
  assert.equal(p.$('[name="title"]').value, 'Typed here', 'the change is still on the page');
  const kept = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.deepEqual([kept.title, kept.status], ['Tasks', 'closed']);
  p.clickText('Discard'); await settle(10);
  p.type('[name="title"]', 'Typed again');
  p.click('[name="save"]'); await settle(10);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.deepEqual([saved.title, saved.status], ['Typed again', 'closed'], 'only the title was sent, so the other window\'s status stays');
});

test('Team size: an impossible range is refused before anything is saved', async () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  p.type('[name="teamMin"]', '5');
  p.type('[name="teamMax"]', '3');
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.text().includes('Team size needs a minimum'));
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize, { min: 1, max: 5 });
});

test('Settings: status, dates, edit key, and question labels are saved', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects', { status: 'draft' });
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  const status = p.$$('select').find((s) => [...s.options].some((o) => o.value === 'archived'));
  status.value = 'closed'; p.fire(status, 'change');
  p.type('[name="keyDays"]', '3');
  p.type('[name="opensAt"]', '2027-10-01T09:00'); p.fire(p.$('[name="opensAt"]'), 'change');
  const row = p.$('[data-field="title"]');
  p.type(row.querySelector('input[aria-label="English label for title"]'), 'Project name');
  p.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.status, 'closed');
  assert.equal(saved.editKey.days, 3);
  assert.ok(saved.opensAt.startsWith('2027-10-01'));
  assert.equal(saved.fields.find((x) => x.id === 'title').label.en, 'Project name');
});

test('Settings: required team parts cannot be switched off', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  // A question that is always asked has no switches to grey out: the row says so.
  ['team_size', 'members', 'leader_code', 'leader_name'].forEach((id) => {
    assert.equal(p.$$(`[data-field="${id}"] input[type="checkbox"]`).length, 0, id);
    assert.equal(p.$(`[data-field="${id}"] .q-show`).textContent, 'Always asked', id);
  });
  assert.equal(p.$$('[data-field="link"] input[type="checkbox"]').length, 2, 'the Drive link can be hidden or made optional');
  assert.deepEqual(['team_size', 'link', 'leader_code', 'email'].map((id) => p.$(`[data-field="${id}"] .q-type`).textContent),
    ['Team size', 'Drive link', 'Student code', 'Email address'], 'a type is named in plain words');
});

test('Responses: each team is its own tinted block with a leader star and a linked task', async () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  const link = (c) => `https://docs.google.com/presentation/d/${ID(c)}/edit`;
  submit(w, f, person({ title: 'Alpha', link: link('a'), members: [member('سارة خالد حسن علي', '4230002')] }));
  submit(w, f, person({ leader_code: '4230010', leader_name: 'عمر يوسف إبراهيم سعيد', title: 'Beta', link: link('b'), members: [member('منى أشرف كمال فؤاد', '4230011'), member('كريم هشام عادل نصر', '4230012')] }));
  submit(w, f, person({ leader_code: '4230020', leader_name: 'ياسر محمود عادل سمير', title: 'Gamma', link: link('c'), members: [] }));
  const p = await openAdmin(w, `#/f/${f.slug}`);
  const blocks = p.$$('.block');
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks.map((b) => b.classList.contains('tint-a') ? 'a' : 'b'), ['a', 'b', 'a'], 'neighbouring teams alternate tints');
  assert.deepEqual(blocks.map((b) => b.querySelectorAll('.mini tbody tr').length), [2, 3, 1]);
  assert.ok(blocks[0].querySelector('tr.leader .icon-star'));
  assert.equal(blocks[0].querySelector('.block-side a').getAttribute('href'), link('a'));
  assert.ok(blocks[0].querySelectorAll('.mini thead th')[2].textContent.includes('Section'));
  assert.ok(p.text().includes('3Total') || p.text().includes('Total'));
  assert.equal(p.$('[data-stat="people"]').textContent, '6People', 'three teams of 2, 3 and 1');
});

test('Small teams: the admin switches on the two warnings with their numbers, and a wrong order stays with its reason', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  const sub = (name) => p.$(`[name="${name}"]`).closest('.sub-setting');
  assert.equal(p.$('[name="criticalAlert"]').checked, false);
  assert.equal(sub('criticalBelow').hidden, true, 'a number shows only for a warning that is on');
  assert.equal(p.$('[name="criticalAlert"]').closest('section').dataset.panel, 'Small teams');
  assert.equal(p.$('[name="criticalAlert"]').closest('section').hidden, false, 'the warnings are in Setup');
  assert.equal(p.$('[name="teamMax"]').closest('section').hidden, true, 'away from the team size question');
  assert.equal(p.$('.savebar').hidden, true, 'opening the page changes nothing');
  p.click('[name="criticalAlert"]'); p.click('[name="warningAlert"]');
  assert.deepEqual([p.$('[name="criticalBelow"]').value, p.$('[name="warningBelow"]').value], ['3', '5'], 'the numbers start from the biggest team size');
  assert.equal(sub('warningBelow').hidden, false);
  assert.equal(p.$('[name="size-alerts-preview"]').textContent, 'Critical: teams of 1 or 2. Warning: teams of 3 or 4.');

  p.type('[name="warningBelow"]', '3');
  assert.ok(p.$('#size-alert-warning-err').textContent.includes('higher number than the critical warning'));
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.$('.savebar-note').textContent.includes('higher number than the critical warning'));
  assert.equal(p.$('[name="warningBelow"]').value, '3', 'the refused number stays in its field');
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sizeAlerts, undefined);

  p.type('[name="teamMax"]', '4');
  p.type('[name="warningBelow"]', '5');
  assert.ok(p.$('#size-alert-warning-err').textContent.includes('from 2 to 4'), 'the biggest team size bounds the number');
  p.type('[name="teamMax"]', '6');
  assert.equal(p.$('#size-alert-warning-err').textContent, '', 'and the reason goes when the range allows it again');
  p.type('[name="criticalBelow"]', '2'); p.type('[name="warningBelow"]', '4');
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sizeAlerts, { critical: { on: true, below: 2 }, warning: { on: true, below: 4 } });
});

test('Responses: small teams are listed by level and marked on their card', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const team = (code, title, codes) => { w.advanceDays(0.01); submit(w, f, person({ leader_code: code, title, members: codes.map((c) => member('سارة خالد حسن علي', c)) })); };
  team('4230001', 'Alpha', []);
  team('4230002', 'Beta', ['4230011', '4230012']);
  team('4230003', 'Gamma', ['4230013', '4230014', '4230015', '4230016']);
  let p = await openAdmin(w, `#/f/${f.slug}`);
  assert.equal(p.$('.size-alerts'), null, 'nothing until a warning is switched on');
  assert.equal(p.$('[name="size-tag"]'), null);

  w.admin({ action: 'admin.forms.update', id: f.id, patch: { rules: { sizeAlerts: { critical: { on: true, below: 3 }, warning: { on: true, below: 5 } } } } });
  p = await openAdmin(w, `#/f/${f.slug}`);
  assert.equal(p.$('.requests [name="size-alert-critical"]').textContent, 'Critical: one team has fewer than 3 people: Team 1.');
  assert.equal(p.$('.requests [name="size-alert-warning"]').textContent, 'Warning: one team has fewer than 5 people: Team 2.');
  assert.deepEqual(p.$$('.team-card').map((c) => { const t = c.querySelector('[name="size-tag"]'); return t ? t.textContent : ''; }), ['Critical', 'Warning', '']);
});

test('Responses: People counts a student once however many tasks name them', async () => {
  const w = boot();
  const tasks = w.make('task_submission', 'Tasks', { rules: { uniqueBy: '', uniqueAcrossForm: false, driveCheck: 'off', maxSubmissions: null, teamSize: { min: 1, max: 5 } } });
  const link = `https://docs.google.com/presentation/d/${ID('a')}/edit`;
  assert.equal(submit(w, tasks, person({ title: 'Task 1', link, members: [member('سارة خالد حسن علي', '4230002')] })).ok, true);
  assert.equal(submit(w, tasks, person({ title: 'Task 2', link, members: [member('سارة خالد حسن علي', '4230002'), member('منى أشرف كمال فؤاد', '4230003')] })).ok, true);
  const p = await openAdmin(w, `#/f/${tasks.slug}`);
  assert.equal(p.$$('.block').length, 2);
  assert.equal(p.$('[data-stat="people"]').textContent, '3People', 'the same three students handed in two tasks');
  p.type('[name="search"]', 'Task 2'); await settle(2);
  assert.equal(p.$('[data-stat="people"]').textContent, '3People', 'the count is of the form, not of the search');
});

test('Responses: a team card shows the number the team was given, also after a cancel and in a search', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects', { rules: { teamSize: { min: 1, max: 3 } } });
  ['Alpha', 'Beta', 'Gamma'].forEach((title, i) => { w.advanceDays(0.01); submit(w, f, person({ leader_code: '423000' + (i + 1), title })); });
  const beta = w.admin({ action: 'admin.submissions', slug: f.slug }).submissions[1];
  w.admin({ action: 'admin.submission.delete', slug: f.slug, submissionId: beta.id });
  const p = await openAdmin(w, '#/f/' + f.slug);
  assert.deepEqual(p.$$('.team-no').map((n) => n.textContent), ['Team 1', 'Team 3']);
  p.type('[name="search"]', 'gamma'); await settle(2);
  assert.deepEqual(p.$$('.team-no').map((n) => n.textContent), ['Team 3'], 'a search does not renumber');
});

test('Responses: search narrows the list and a status change is saved', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  submit(w, f, person({ title: 'Alpha', members: [] }));
  submit(w, f, person({ leader_code: '4230020', title: 'Beta', members: [] }));
  const p = await openAdmin(w, `#/f/${f.slug}`);
  p.type('[name="search"]', 'beta');
  assert.equal(p.$$('.block').length, 1);
  assert.ok(p.$('.block').textContent.includes('Beta'));
  const sel = p.$('.block select');
  sel.value = 'approved'; p.fire(sel, 'change'); await settle(8);
  const row = w.admin({ action: 'admin.submissions', slug: f.slug }).submissions.find((s) => s.title === 'Beta');
  assert.equal(row.status, 'approved');
});

test('Responses: details open, and resetting a key gives a new one and kills the old one', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const first = submit(w, f, person({ title: 'Alpha', members: [] }));
  const p = await openAdmin(w, `#/f/${f.slug}`);
  p.click('[name="details"]'); await settle(2);
  assert.ok(p.$('.dialog').textContent.includes('TR-2027-0001'));
  p.clickText('Reset key', p.$('.dialog')); await settle(8);
  const fresh = p.$('.key-reveal').textContent;
  assert.match(fresh, /^\d{5}$/);
  assert.equal(w.api({ action: 'lookup', slug: f.slug, key: first.key }).error.code, 'bad_key');
  assert.equal(w.api({ action: 'lookup', slug: f.slug, key: fresh }).ok, true);
});

test('Reservation teammates: an admin can enable and disable teammate collection', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  const field = p.$('[name="reservation-members"]');
  assert.ok(field, 'settings exposes a teammate collection toggle');
  assert.equal(field.checked, false, 'existing reservation forms keep solo booking as the default');
  field.checked = true; p.fire(field, 'change');
  p.click('[name="save"]'); await settle(12);
  let saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  const members = saved.fields.find((item) => item.role === 'members');
  assert.equal(members.enabled, true);
  assert.equal(members.required, true);
  assert.ok(saved.steps.some((step) => step.fields.includes(members.id)));
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { slots: { days: [{ id: 'one', label: 'Sunday', times: ['12:30 - 12:50'] }], capacity: 1 } } });
  w.api({ action: 'submit', slug: f.slug, data: person({ leader_code: '4230002', title: 'Library', slot: { day: 'one', time: '12:30 - 12:50' }, members: [member('سارة خالد حسن علي', '4230003')] }) });

  const reload = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(reload.$('[name="reservation-members"]').checked, true);
  reload.$('[name="reservation-members"]').checked = false; reload.fire(reload.$('[name="reservation-members"]'), 'change');
  reload.click('[name="save"]'); await settle(12);
  saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.fields.find((item) => item.role === 'members').enabled, false);
  assert.equal(saved.fields.find((item) => item.role === 'members').required, false);
  const rows = w.admin({ action: 'admin.submissions', slug: f.slug }).submissions;
  assert.deepEqual(rows[0].data.members, [], 'disabled roster details are not exposed in submissions');
});

/** Moves the timetable calendar to a month, written as it is shown: "March 2028". */
function showMonth(p, month) {
  for (let i = 0; i < 240 && p.$('.tt-cal-month').textContent !== month; i++) p.click('[name="cal-next"]');
  assert.equal(p.$('.tt-cal-month').textContent, month);
}
const slotTexts = (p, row) => [...p.$$('.tt-row')[row].querySelectorAll('.tt-slot')].map((c) => c.firstChild.textContent);

test('Reservation teammates: how many, the title students read, and what is asked about each one', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar', { slots: { days: [{ id: 'one', label: 'Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }], capacity: 1 } });
  const p = await openAdmin(w, `#/f/${f.slug}/questions`);
  assert.ok(p.$('.tm-body').hidden, 'the settings exist only while teammates are asked');
  const ask = p.$('[name="reservation-members"]'); ask.checked = true; p.fire(ask, 'change');
  assert.equal(p.$('.tm-body').hidden, false);
  const choices = () => p.$('.tm-body .size-preview').textContent;
  assert.equal(choices(), 'A leader can bring: 12345 teammates', 'the same control as the team size');
  p.type('[name="teammatesMin"]', '0');
  p.type('[name="teammatesMax"]', '2');
  assert.equal(choices(), 'A leader can bring: 012 teammates', 'a leader may book alone');
  p.type('[name="teammatesMin"]', '3');
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.text().includes('The number of teammates needs a minimum of at least 0 and a maximum that is not lower and at least 1, up to 19.'), 'a range upside down is refused');
  p.type('[name="teammatesMin"]', '0');
  p.click('[name="teammates-notice-size-0"]');
  p.type('[name="teammates-noticeEn"]', 'Other students may join you, up to {max}.');
  assert.ok(p.$('.tm-body .notice-preview').textContent.includes('Other students may join you, up to 2.'), 'the note is previewed as the team size note is');
  p.type('[name="teammates-title-en"]', 'Who comes with you');
  const phone = p.$('.tm-questions [data-field="phone"] .q-show input');
  phone.checked = false; p.fire(phone, 'change');
  assert.equal(p.$('.tm-questions [data-field="name"] .q-show').textContent, 'Always asked');
  p.click('[name="save"]'); await settle(12);

  const members = w.admin({ action: 'admin.forms.get', id: f.id }).form.fields.find((x) => x.role === 'members');
  assert.deepEqual([members.enabled, members.required, members.min, members.max, members.label.en], [true, false, 0, 2, 'Who comes with you']);
  assert.deepEqual(members.notice, { sizes: [0], text: { en: 'Other students may join you, up to {max}.', ar: '' } });
  assert.equal(members.fields.find((x) => x.id === 'phone').enabled, false);
  const book = (code, time, list) => w.api({ action: 'submit', slug: f.slug, data: person({ leader_code: code, title: 'Library', slot: { day: 'one', time }, members: list }) });
  assert.equal(book('4230010', '12:30 - 12:50', []).ok, true, 'a leader books alone');
  const three = ['4230011', '4230012', '4230013'].map((c) => member('سارة خالد حسن علي', c));
  assert.equal(book('4230020', '12:55 - 1:15', three).ok, false, 'more teammates than the most is refused');
  const noPhone = { ...member('سارة خالد حسن علي', '4230021') }; delete noPhone.phone;
  assert.equal(book('4230020', '12:55 - 1:15', [noPhone]).ok, true, 'a hidden detail is not needed');

  // The saved bookings that a new range leaves outside are counted before the save, as saved teams are.
  const again = await openAdmin(w, `#/f/${f.slug}/questions`);
  const outside = () => again.$('[name="teammates-conflicts"]');
  assert.ok(outside().hidden, 'both bookings fit 0 to 2');
  again.type('[name="teammatesMin"]', '1');
  assert.equal(outside().textContent, '1 saved booking is outside 1 to 2. It stays booked as it is. Widen the range, or ask that team to change their teammates.');
});

test('Timetable: a day with no date gets a name and the general hours, and bookings appear grouped by day', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.ok(p.text().includes('No days yet.'));
  p.click('[name="add-undated"]');
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.text().includes('Give every day a date or a name.'), 'a day without a name is refused');
  p.type('[name="day-name-0"]', 'Week 11 - Sunday');
  assert.deepEqual(slotTexts(p, 0).slice(0, 2), ['12:30 - 12:50', '12:55 - 1:15'], 'a new day starts with the general hours');
  p.click('[name="save"]'); await settle(12);
  const days = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots.days;
  assert.equal(days[0].id, 'week-11-sunday');
  assert.equal(days[0].times.length, 7);

  w.api({ action: 'submit', slug: f.slug, data: person({ title: 'Library', slot: { day: 'week-11-sunday', time: '12:55 - 1:15' } }) });
  const q = await openAdmin(w, `#/f/${f.slug}`);
  const day = q.$('.block.single[data-day="week-11-sunday"]');
  assert.ok(day.textContent.includes('1 booked'));
  assert.ok(day.querySelector('tbody td.mono').textContent.includes('12:55 - 1:15'));
});

test('Timetable: dates picked on the calendar become days that follow the hours', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  p.type('[name="hours-start"]', '10:00'); p.type('[name="hours-end"]', '11:00');
  p.type('[name="hours-length"]', '15'); p.type('[name="hours-gap"]', '0');
  assert.ok(p.text().includes('4 slots a day: 10:00 - 10:15 to 10:45 - 11:00'), 'the hours say what they give');
  showMonth(p, 'March 2028');
  p.click('[name="cal-2028-03-19"]'); p.click('[name="cal-2028-03-12"]'); p.click('[name="cal-2028-03-14"]');
  assert.equal(p.$('[name="cal-2028-03-12"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(p.$$('.tt-row').map((r) => r.dataset.day), ['2028-03-12', '2028-03-14', '2028-03-19'], 'days are kept in date order');
  assert.ok(p.text().includes('3 days · 12 slots · 12 bookings at most'));
  p.click('[name="cal-2028-03-14"]');
  assert.equal(p.$('[name="cal-2028-03-14"]').getAttribute('aria-pressed'), 'false', 'a second click removes the day');
  assert.equal(p.$$('.tt-row').length, 2);

  p.click('[name="slot-0-3"]');
  assert.equal(p.$('[name="slot-0-3"]').getAttribute('aria-pressed'), 'false');
  assert.ok(p.$$('.tt-row')[0].textContent.includes('3 slots'));
  p.click('[name="capacity-up"]');
  assert.ok(p.text().includes('2 days · 7 slots · 14 bookings at most'));
  p.click('[name="save"]'); await settle(12);
  const slots = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots;
  assert.equal(slots.capacity, 2);
  assert.deepEqual(slots.pattern, { start: '10:00', end: '11:00', length: 15, gap: 0 });
  assert.deepEqual(slots.days.map((d) => [d.date, d.label]), [['2028-03-12', 'Sunday 12 Mar'], ['2028-03-19', 'Sunday 19 Mar']]);
  assert.deepEqual(slots.days[0].times, ['10:00 - 10:15', '10:15 - 10:30', '10:30 - 10:45']);
  assert.equal(slots.days[1].times.length, 4);

  const q = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(q.$('.tt-cal-month').textContent, 'March 2028', 'the calendar opens on the month of the saved days');
  assert.equal(q.$('[name="slot-0-3"]').getAttribute('aria-pressed'), 'false', 'a slot switched off is still shown, switched off');
  q.click('[name="slot-0-3"]');
  assert.equal(q.$('[name="slot-0-3"]').getAttribute('aria-pressed'), 'true');
});

test('Timetable: one day can have its own hours, go back to the general ones, and take another name', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  showMonth(p, 'March 2028');
  p.click('[name="cal-2028-03-12"]'); p.click('[name="cal-2028-03-14"]');
  assert.equal(p.$('[name="day-start-1"]'), null, 'own hours stay closed until asked for');
  p.click('[name="own-hours-1"]');
  assert.equal(p.$('[name="day-start-1"]').value, '12:30', 'own hours start from the general ones');
  assert.equal(p.$('[name="own-hours-1"]'), null);
  p.type('[name="day-end-1"]', '13:20');
  assert.deepEqual(slotTexts(p, 1), ['12:30 - 12:50', '12:55 - 1:15']);
  assert.equal(slotTexts(p, 0).length, 7, 'the other day is untouched');
  p.type('[name="hours-end"]', '14:10');
  assert.equal(slotTexts(p, 0).length, 4, 'the general hours move the days that follow them');
  assert.equal(slotTexts(p, 1).length, 2, 'and leave a day with its own hours alone');

  p.type('[name="day-end-1"]', '12:35');
  assert.ok(p.$$('.tt-row')[1].textContent.includes('These hours leave no room for a slot'));
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.text().includes('"Tuesday 14 Mar" has no time slots.'));
  p.click('[name="general-hours-1"]');
  assert.equal(slotTexts(p, 1).length, 4);

  p.click('[name="rename-day-0"]');
  p.type('[name="day-name-0"]', 'Week 11 - Sunday');
  p.click('[name="remove-day-1"]');
  assert.equal(p.$('[name="cal-2028-03-14"]').getAttribute('aria-pressed'), 'false', 'the calendar follows a day removed from the list');
  p.click('[name="save"]'); await settle(12);
  const days = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots.days;
  assert.deepEqual(days.map((d) => [d.label, d.date, d.times.length]), [['Week 11 - Sunday', '2028-03-12', 4]]);
});

test('Timetable: a booked slot shows its count, and switching it off warns before saving', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', slots: { days: [{ id: 'one', label: 'Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }], capacity: 1 } } });
  const form = w.api({ action: 'getForm', slug: f.slug }).form;
  const data = { email: 'a@example.com', leader_name: 'أحمد محمد محمود علي', leader_code: '4230459', phone: '01012345678', title: 'Library', slot: { day: 'one', time: '12:55 - 1:15' } };
  for (const field of form.fields) if (field.type === 'select' && field.enabled !== false) data[field.id] = String(field.options[0].value);
  assert.equal(w.api({ action: 'submit', slug: f.slug, data }).ok, true);
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$$('.tt-slot').length, 7, 'times that are off are offered next to the two that are on');
  assert.equal(p.$$('.tt-slot[aria-pressed="true"]').length, 2);
  const slot = () => p.$('.tt-slot.booked');
  assert.equal(slot().querySelector('.tt-slot-n').textContent, '1');
  assert.ok(p.$('.tt-row').textContent.includes('1 booked'));
  assert.equal(p.$('[name="orphans"]'), null);
  p.click('.tt-slot.booked');
  assert.equal(slot().getAttribute('aria-pressed'), 'false');
  assert.ok(p.$('[name="orphans"]').textContent.includes('1 booking is on a day or a time that is no longer here'));
  p.click('.tt-slot.booked');
  assert.equal(p.$('[name="orphans"]'), null, 'putting the slot back clears the warning');
});

test('Timetable: times saved by hand are kept as they are until the day gets hours', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { slots: { days: [{ id: 'one', label: 'Sunday', times: ['9:00 - 9:30', '11:30 - 11:45'] }], capacity: 1 } } });
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.deepEqual(slotTexts(p, 0), ['9:00 - 9:30', '11:30 - 11:45']);
  p.type('[name="hours-end"]', '14:10');
  assert.deepEqual(slotTexts(p, 0), ['9:00 - 9:30', '11:30 - 11:45'], 'the general hours do not replace them');
  assert.equal(p.$('[name="own-hours-0"]').textContent, 'Set hours for this day');
  p.click('[name="own-hours-0"]');
  assert.equal(slotTexts(p, 0).length, 4);
});

test('WhatsApp: paste requests, see matches beside the registration, and approve', async () => {
  const w = boot();
  const f = w.make('whatsapp_registration', 'Groups');
  w.api({ action: 'submit', slug: f.slug, data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230999', level: 'صفر / الأولى', major: 'حاسبات', group: 'A', section: '21', schedule: `https://drive.google.com/file/d/${ID('s')}/view` } });
  const p = await openAdmin(w, `#/f/${f.slug}`);
  assert.ok(p.$('.split'), 'split screen is the default');
  p.type('[name="paste"]', 'Sara Ali +20 10 1234 5678\nStranger 01155555555\nno number here');
  p.click('[name="import"]'); await settle(12);
  const reqs = p.$$('.req');
  assert.equal(reqs.length, 2);
  assert.ok(reqs[0].textContent.includes('Matched'));
  assert.ok(reqs[1].textContent.includes('No match'));
  p.click(reqs[0]); await settle(2);
  assert.ok(p.$('.detail').textContent.includes('4230999'));
  assert.ok(p.$('iframe.preview').getAttribute('src').includes(ID('s')));
  p.click('[name="approve"]'); await settle(12);
  assert.ok(p.text().includes('Finish "Timetable check" first'), 'step 2 waits for step 1');
  assert.equal(w.admin({ action: 'admin.submissions', slug: f.slug }).submissions[0].review.group, 'pending');

  const step1 = p.$('.detail select[aria-label^="Timetable check"]');
  step1.value = 'approved'; p.fire(step1, 'change'); await settle(10);
  p.click('[name="approve"]'); await settle(12);
  const sub = w.admin({ action: 'admin.submissions', slug: f.slug }).submissions[0];
  assert.deepEqual(sub.review, { schedule: 'approved', group: 'approved' });
  p.click('[data-filter="approved"]'); await settle(2);
  assert.equal(p.$$('.req').length, 1);
});

test('Clients: create a private link, see it once, and it opens the instructor view', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, '#/clients');
  p.click('[name="newClient"]'); await settle(2);
  p.type('[name="clientName"]', 'Dr. Ahmed');
  const all = p.$$('.dialog .check').find((l) => l.textContent.includes('All forms')).querySelector('input');
  all.checked = true; p.fire(all, 'change');
  const phone = p.$$('.dialog .check').find((l) => l.textContent === 'Phone').querySelector('input');
  phone.checked = true; p.fire(phone, 'change');
  assert.equal(p.$('[name="withKey"]').checked, true, 'a new link asks for a key unless unticked');
  const key = p.$('[name="withKey"]'); key.checked = false; p.fire(key, 'change');
  assert.equal(p.$('[name="showSizeAlerts"]').checked, true, 'a new link shows the warnings about small teams unless unticked');
  const alerts = p.$('[name="showSizeAlerts"]'); alerts.checked = false; p.fire(alerts, 'change');
  p.clickText('Create link', p.$('.dialog')); await settle(10);
  const link = p.$('.link-box code').textContent;
  assert.equal(p.$('[name="access-key"]'), null, 'no key was made');
  assert.ok(link.includes('viewer.html?t='));
  const token = new URL(link).searchParams.get('t');
  const me = w.api({ action: 'viewer.me', token });
  assert.equal(me.client.name, 'Dr. Ahmed');
  assert.deepEqual(me.forms.map((x) => x.slug), [f.slug]);
  assert.deepEqual(w.admin({ action: 'admin.clients.list' }).clients[0].hiddenColumns, ['phone']);
  assert.equal(w.admin({ action: 'admin.clients.list' }).clients[0].showSizeAlerts, false);
});

test('Lists: a plain list is chips, and the save bar exists only while it differs from the saved copy', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/lists');
  assert.ok(p.$('.lists') && !p.$('.lists').classList.contains('picked'), 'no list in the address: a phone shows the lists');
  assert.ok(p.$('[name="pick-sections"]').textContent.includes('4C-TH1, 4C-TH2, 4C-TH3, 4C-TH4 …'), 'a card names the first choices');
  p.click('[name="pick-groups"]'); await settle(2);
  assert.ok(p.$('.lists').classList.contains('picked'));
  assert.equal(p.win.location.hash, '#/lists/groups');
  assert.ok(p.$('.value-chips'), 'plain values are chips');
  assert.equal(p.$('[name="new-en"]'), null, 'chips ask for the choice only');
  assert.ok(p.$('.savebar').hidden, 'nothing to save yet');
  p.type('[name="new-value"]', 'C');
  p.$('[name="new-value"]').dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(p.$('.savebar').hidden, false);
  assert.ok(p.$('.savebar').textContent.includes('Groups: 1 added. Not saved yet.'));
  assert.ok(p.$('[name="pick-groups"]').textContent.includes('Not saved'));
  p.click('[name="remove-2"]');
  assert.ok(p.$('.savebar').hidden, 'back to the saved choices, so the bar is gone');
  p.type('[name="new-value"]', 'C'); p.click('[name="add-choice"]');
  p.click('[name="save-list"]'); await settle(8);
  assert.deepEqual(w.admin({ action: 'admin.lists.get' }).lists.groups.map((o) => o.value), ['A', 'B', 'C']);
  assert.ok(p.$('.savebar').hidden);
  p.click('[name="all-lists"]');
  assert.equal(p.win.location.hash, '#/lists');
  assert.ok(!p.$('.lists').classList.contains('picked'));
});

test('Lists: a list with English names is rows that can be added to and reordered, and every form follows', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, '#/lists/majors');
  assert.ok(p.$('.lists').classList.contains('picked'), 'the address opens the list');
  assert.ok(p.$('[name="en-0"]'), 'named choices are rows');
  assert.equal(p.$('[name="ar-0"]'), null, 'no Arabic name column while no choice has one');
  assert.equal(p.$('[name="edit-rows"]') || p.$('[name="short-view"]'), null, 'named choices have no short view');
  assert.ok(p.$('.used-by').textContent.includes('Projects'), 'the forms that ask the list are named');
  p.type('[name="new-value"]', 'كهرباء'); p.type('[name="new-en"]', 'Power');
  p.click('[name="add-choice"]');
  p.click('.choice[data-i="5"] [aria-label="Move up"]');
  p.click('[name="save-list"]'); await settle(8);
  const major = w.api({ action: 'getForm', slug: f.slug }).form.fields.find((x) => x.id === 'major');
  assert.deepEqual(major.options.map((o) => o.label.en), ['Computers', 'Communications', 'Architecture', 'Mechanical', 'Power', 'Civil']);
});

test('Lists: a refused save says why next to the choices, and a removed choice names the form limited to it', async () => {
  const w = boot();
  w.make('team_registration', 'Projects', { rules: { majors: ['حاسبات'] } });
  const p = await openAdmin(w, '#/lists/majors');
  p.type('[name="value-1"]', 'حاسبات');
  assert.ok(p.text().includes('"حاسبات" is in the list twice. Remove one of them.'));
  assert.ok(p.$('.choice[data-i="1"]').classList.contains('bad'), 'the row is marked');
  assert.equal(p.$('[name="value-1"]').value, 'حاسبات', 'the refused value stays in its field');
  p.click('[name="save-list"]'); await settle(8);
  assert.equal(w.admin({ action: 'admin.lists.get' }).lists.majors[1].value, 'اتصالات', 'nothing was saved');
  p.click('[name="discard"]');
  p.click('[name="remove-0"]');
  assert.ok(p.$('.savebar').textContent.includes('Majors: 1 removed. Not saved yet.'));
  assert.ok(p.$('.savebar-warn').textContent.includes('Limited to a removed choice: Projects.'));
  p.click('[name="discard"]');
  assert.ok(p.$('.savebar').hidden);

  p.click('[name="pick-groups"]'); await settle(2);
  p.click('[name="remove-0"]'); p.click('[name="remove-0"]');
  assert.ok(p.text().includes('A list needs at least one choice.'));
  p.click('[name="pick-levels"]'); await settle(2);
  assert.ok(p.text().includes('Leave without saving?'), 'another list is opened only after the admin agrees');
});

test('Lists: a year group is added from its own card, with the counts the admin sets and nothing copied', async () => {
  const w = boot();
  w.make('team_registration', 'Projects', { rules: { sections: ['4C-O3'] } });
  const p = await openAdmin(w, '#/lists/sections');
  assert.equal(p.$('[name="count-4C-TH"]').value, '8', 'the saved list reads as 4C with 8 TH, 3 T and 3 O');
  assert.equal(p.$('[name="count-4C-O"]').value, '3');
  assert.ok(p.$('.savebar').hidden);
  assert.equal(p.$('[name="group-draft"]'), null, 'nothing about adding is open until it is asked for');
  p.click('[name="add-group-open"]');
  assert.equal(p.$('[name="add-group-open"]'), null);
  assert.equal(p.$('[name="add-group"]'), null, 'Add appears once the group can be added');
  assert.equal(p.$('[name="group-missing"]').textContent, 'Pick a year and a department letter.');
  assert.deepEqual(p.$$('[name^="group-year-"]').map((n) => n.textContent), ['1', '2', '3', '4', '5']);
  assert.deepEqual(p.$$('[name^="group-letter-"]').map((n) => n.textContent), ['C', '+ New letter'], 'the letters are the ones the lists use');
  assert.deepEqual(p.$$('[name^="draft-count-"].stepper-input').map((n) => [n.name, n.value]), [['draft-count-TH', '0'], ['draft-count-T', '0'], ['draft-count-O', '0']], 'every kind of the lists starts at 0');
  p.click('[name="group-year-3"]');
  assert.equal(p.$('[name="group-missing"]').textContent, 'Pick a department letter.');
  p.click('[name="group-letter-add"]'); p.type('[name="group-letter-new"]', 'l');
  assert.equal(p.$('[name="group-missing"]').textContent, 'Set at least one kind above 0.');
  p.type('[name="draft-count-TH"]', '6');
  p.type('[name="draft-count-T"]', '3');
  assert.equal(p.$('[name="group-missing"]').textContent, '');
  assert.equal(p.$('[name="add-group"]').textContent, 'Add 3L', 'the button names the group, and nothing else is taken from 4C');
  assert.ok(p.$('.savebar').hidden, 'a group being drawn is not a change yet');
  p.$('[name="draft-count-T"]').dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(p.$('[name="group-draft"]'), null, 'Enter in a count adds the group');
  assert.deepEqual(p.$$('[data-group]').map((g) => g.dataset.group), ['3L', '4C'], 'a new group goes in year order');
  assert.equal(p.$('[name="count-3L-TH"]').value, '6');
  assert.equal(p.$('[name="count-3L-O"]'), null, 'a kind left at 0 is not in the group');
  assert.equal(p.$('[name="group-letter-L"]'), null, 'the typed letter is used by a group, not kept as a chip of its own');
  p.click('[name="count-4C-O-down"]');
  assert.ok(p.$('.savebar').textContent.includes('Sections: 9 added, 1 removed. Not saved yet.'));
  assert.ok(p.$('.savebar-warn').textContent.includes('Limited to a removed choice: Projects.'));
  p.click('[name="add-group-open"]');
  assert.ok(p.$('[name="group-letter-L"]'), 'once a group uses a letter, it is a chip');
  p.click('[name="group-year-4"]'); p.click('[name="group-letter-C"]'); p.type('[name="draft-count-TH"]', '1');
  assert.equal(p.$('[name="group-missing"]').textContent, '4C is already in this list.');
  assert.equal(p.$('[name="add-group"]'), null);
  p.click('[name="add-group-cancel"]');
  assert.equal(p.$('[name="group-draft"]'), null);
  p.click('[name="save-list"]'); await settle(8);
  const saved = w.admin({ action: 'admin.lists.get' }).lists.sections.map((o) => o.value);
  assert.equal(saved.length, 22);
  assert.deepEqual(saved.slice(0, 9), ['3L-TH1', '3L-TH2', '3L-TH3', '3L-TH4', '3L-TH5', '3L-TH6', '3L-T1', '3L-T2', '3L-T3']);
});

test('Lists: a kind is added by name or removed with its own button, and a count never reaches 0', async () => {
  const w = boot();
  w.admin({ action: 'admin.lists.set', key: 'sections', values: ['4C-TH1', '4C-TH2', '4C-T1', '4C-TH01'] });
  const p = await openAdmin(w, '#/lists/sections');
  assert.deepEqual(p.$$('[name^="count-4C-"].stepper-input').map((n) => n.name), ['count-4C-TH', 'count-4C-T']);
  assert.ok(p.text().includes('4C-TH01'), 'a number written with a leading zero is kept as written, under Other sections');
  assert.equal(p.$('[name="count-4C-T-down"]').disabled, true, 'a count stops at 1');
  p.type('[name="count-4C-T"]', '0');
  assert.equal(p.$('[name="count-4C-T"]').value, '1', 'a typed 0 is taken as 1');
  p.click('[name="kind-4C-add"]');
  p.type('[name="kind-4C-new"]', 't');
  p.click('[name="kind-4C-take"]');
  assert.equal(p.$('#kind-4C-err').textContent, 'T is already a kind.', 'a kind that exists is refused with the reason');
  assert.equal(p.$('[name="kind-4C-new"]').value, 'T', 'and stays in its field');
  p.type('[name="kind-4C-new"]', 'lab');
  p.click('[name="kind-4C-take"]');
  assert.equal(p.$('[name="count-4C-LAB"]').value, '1', 'a typed kind is added in capitals with one section');
  p.click('[name="remove-kind-4C-T"]');
  assert.equal(p.$('[name="count-4C-T"]'), null);
  assert.ok(p.$('[name="add-kind-4C-T"]'), 'a removed kind can be added back');
  p.click('[name="remove-kind-4C-TH"]');
  assert.equal(p.$('[name="remove-kind-4C-LAB"]'), null, 'the last kind of a group has no remove of its own: it goes with the group');
  p.click('[name="save-list"]'); await settle(8);
  assert.deepEqual(w.admin({ action: 'admin.lists.get' }).lists.sections.map((o) => o.value), ['4C-LAB1', '4C-TH01']);
});

test('Lists: a run of numbers is set with two steppers', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/lists/wa_sections');
  assert.equal(p.$('[name="range-to"]').value, '33');
  p.click('[name="range-to-down"]'); p.click('[name="range-to-down"]');
  p.click('[name="range-from-up"]');
  assert.ok(p.text().includes('30 choices: 2 to 31'));
  assert.ok(p.$('.savebar').textContent.includes('3 removed'));
  const to = p.$('[name="range-to"]'); to.value = '40'; p.fire(to, 'change');
  assert.ok(p.text().includes('39 choices: 2 to 40'), 'the number can also be typed');
  p.click('[name="save-list"]'); await settle(8);
  const saved = w.admin({ action: 'admin.lists.get' }).lists.wa_sections.map((o) => o.value);
  assert.deepEqual([saved[0], saved[saved.length - 1], saved.length], ['2', '40', 39]);
});

test('Lists: a new list of sections, picked for the section question of one form, limits that form', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, '#/lists');
  p.click('[name="new-list"]'); await settle(2);
  assert.equal(p.win.location.hash, '#/lists/new');
  assert.equal(p.$('[name="create-list"]'), null, 'nothing to make before it has a name');
  p.type('[name="list-name"]', 'Sections');
  p.click('[name="copy-none"]');
  p.click('[name="create-list"]'); await settle(8);
  assert.ok(p.text().includes('Another list has that name.'), 'the reason is next to the name');
  assert.equal(p.$('[name="list-name"]').value, 'Sections');
  p.type('[name="list-name"]', 'Third year');
  p.click('[name="create-list"]'); await settle(8);
  assert.equal(p.win.location.hash, '#/lists/third_year');
  assert.ok(p.$('[name="delete-list"]'), 'a list no form asks can be deleted');
  assert.ok(p.$('[name="add-group-open"]').classList.contains('btn-primary'), 'an empty list leads with Add a year group');
  p.click('[name="add-group-open"]');
  p.click('[name="group-year-3"]'); p.click('[name="group-letter-add"]'); p.type('[name="group-letter-new"]', 'L');
  p.click('[name="draft-count-TH-up"]'); p.type('[name="draft-count-T"]', '2'); p.click('[name="add-group"]');
  p.click('[name="save-list"]'); await settle(8);
  assert.deepEqual(w.admin({ action: 'admin.lists.get' }).lists.third_year.map((o) => o.value), ['3L-TH1', '3L-T1', '3L-T2']);

  const q = await openAdmin(w, `#/f/${f.slug}/questions`);
  assert.equal(q.$('[name="list-level"]'), null, 'a question with no other list to read offers no choice');
  const pick = q.$('[name="list-section"]');
  pick.value = 'third_year'; q.fire(pick, 'change');
  q.click(`[href="#/f/${f.slug}/settings"]`); await settle(4);
  assert.ok(q.$('[name="section-3L-T2"]'), 'Who can register offers the sections of the list now read');
  q.click('[name="section-3L-T1"]');
  q.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.fields.find((x) => x.id === 'section').list, 'third_year');
  assert.equal(saved.fields.find((x) => x.role === 'members').fields.find((x) => x.id === 'section').list, 'third_year', 'the members follow the leader');
  const offered = w.api({ action: 'getForm', slug: f.slug }).form.fields.find((x) => x.id === 'section').options.map((o) => o.value);
  assert.deepEqual(offered, ['3L-T1'], 'students are offered the picked sections of the new list');

  const r = await openAdmin(w, '#/lists/third_year');
  assert.equal(r.$('[name="delete-list"]'), null, 'no Delete while a form asks the list');
  assert.equal(w.admin({ action: 'admin.lists.delete', key: 'third_year' }).error.code, 'list_in_use');
  assert.equal(w.admin({ action: 'admin.lists.delete', key: 'sections' }).error.code, 'list_builtin');
  r.click('[name="rename-list"]'); r.type('[name="rename-input"]', 'Year 3 sections'); r.click('[name="rename-save"]'); await settle(6);
  assert.ok(r.$('.list-title h2').textContent.includes('Year 3 sections'));
});

test('Questions: an admin adds a description and students read it under the question', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.ok(p.$('[data-desc="link"]').hidden, 'no description yet, so its editor is folded away');
  p.click('[name="desc-link"]');
  assert.equal(p.$('[data-desc="link"]').hidden, false);
  p.type('[name="help-en-link"]', 'Name it Name_Project_Name_Subject and share it with anyone');
  p.type('[name="help-ar-link"]', 'اعمل شير للفولدر');
  p.click('[name="save"]'); await settle(12);
  const link = w.api({ action: 'getForm', slug: f.slug }).form.fields.find((x) => x.id === 'link');
  assert.deepEqual(link.help, { en: 'Name it Name_Project_Name_Subject and share it with anyone', ar: 'اعمل شير للفولدر' });
});

test('Team size note: the admin picks sizes, writes the note, and it is saved', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects', { rules: { teamSize: { min: 1, max: 5 } } });
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  p.click('[name="notice-size-3"]'); p.click('[name="notice-size-4"]');
  assert.equal(p.$('[name="notice-size-3"]').getAttribute('aria-pressed'), 'true');
  p.click('[name="save"]'); await settle(8);
  assert.ok(p.text().includes('Write the note for team size'), 'sizes without text are refused');
  p.type('[name="noticeEn"]', 'Others join to reach {max}.');
  assert.ok(p.$('.notice-preview').textContent.includes('Others join to reach 5.'), 'live preview fills the placeholders');
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize.notice, { sizes: [3, 4], text: { en: 'Others join to reach {max}.', ar: '' } });
});

test('Term: settings show the saved season and year, and switching season saves the new term', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="season-fall"]').getAttribute('aria-pressed'), 'true');
  assert.equal(p.$('[name="termYear"]').value, '2027/2028');
  p.click('[name="season-summer"]');
  p.type('[name="subject"]', 'CMPn336');
  p.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.term, 'Summer 2027/2028');
  assert.equal(saved.subject, 'CMPn336');
  const pub = w.api({ action: 'getForm', slug: saved.slug }).form;
  assert.equal(pub.subject, 'CMPn336', 'students get the subject code');
});

test('Who can register: picking one specialization saves it, All clears it', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.equal(p.$('[name="major-all"]').getAttribute('aria-pressed'), 'true');
  p.click('[name="major-حاسبات"]');
  assert.ok(p.text().includes('Only Computers students can register'));
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.majors, ['حاسبات']);
  const q = await openAdmin(w, `#/f/${f.slug}/settings`);
  q.click('[name="major-all"]'); q.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.majors, []);
});

test('Delete form: one confirmation from the card removes it; cancelling keeps it', async () => {
  const w = boot();
  w.make('team_registration', 'Old projects');
  const p = await openAdmin(w);
  p.click('[name="delete-form"]'); await settle(2);
  assert.ok(p.text().includes('Delete "Old projects"?'));
  p.clickText('Keep it'); await settle(4);
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 1);
  p.click('[name="delete-form"]'); await settle(2);
  p.click('.overlay .btn-danger'); await settle(12);
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 0);
  assert.ok(p.text().includes('No forms yet'));
});

test('Details: the admin can show a student key and the email switch is saved', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const r = submit(w, f, person({ title: 'Library System', members: [] }));
  const p = await openAdmin(w, `#/f/${f.slug}`);
  p.click('[name="details"]'); await settle(2);
  p.click('[name="show-key"]'); await settle(6);
  assert.equal(p.$('.key-inline').textContent, r.key);
  const q = await openAdmin(w, `#/f/${f.slug}/settings`);
  const box = q.$('[name="confirmEmail"]'); box.checked = false; q.fire(box, 'change');
  q.click('[name="save"]'); await settle(12);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.notifications.confirmEmail, false);
});

test('Settings: saving project and task forms preserves enabled teammate collection', async () => {
  for (const type of ['team_registration', 'task_submission']) {
    const w = boot();
    const f = w.make(type, 'Teams');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    p.click('[name="save"]'); await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    const members = saved.fields.find((field) => field.role === 'members');
    assert.notEqual(members.enabled, false);
    assert.equal(members.required, true);
    p.dom.window.close();
  }
});

test('Responses and clients: list rows carry their column names, and the day sheet controls are one group', async () => {
  const w = boot();
  const groups = w.admin({ action: 'admin.forms.create', type: 'whatsapp_registration', title: 'Groups', batchYear: '2028/2029' }).form;
  w.admin({ action: 'admin.forms.update', id: groups.id, patch: { status: 'open' } });
  w.api({ action: 'submit', slug: groups.slug, data: { email: 'a@b.com', name: 'أحمد محمد محمود أحمد', phone: '01012345678', code: '4230001', level: 'صفر / الأولى', major: 'حاسبات', group: 'A', section: '21', schedule: 'https://drive.google.com/file/d/' + 't'.repeat(33) + '/view' } });
  const list = await openAdmin(w, `#/f/${groups.slug}`);
  list.clickText('All registrations'); await settle(6);
  const labels = list.$$('.data-table.cards tbody tr:first-child td[data-label]').map((c) => c.dataset.label);
  assert.deepEqual(labels.slice(0, 5), ['Code', 'Phone', 'Group', 'Section', 'Timetable']);
  assert.equal(labels[labels.length - 1], 'Status');

  w.admin({ action: 'admin.clients.create', name: 'Dr. Ahmed', forms: [groups.slug], withKey: false });
  const clients = await openAdmin(w, '#/clients');
  assert.deepEqual(clients.$$('.data-table.cards tbody td[data-label]').map((c) => c.dataset.label), ['Can see', 'Hidden columns', 'Can review', 'Small teams', 'Link', 'Access key']);

  const seminar = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Seminar', term: 'Fall 2027' }).form;
  assert.equal((await openAdmin(w, `#/f/${seminar.slug}`)).$('.tool-group'), null, 'no day sheet to print while the form has no days');
  w.admin({ action: 'admin.forms.update', id: seminar.id, patch: { slots: { days: [{ label: 'Sunday', times: ['12:30 - 12:50'] }], capacity: 1 } } });
  const res = await openAdmin(w, `#/f/${seminar.slug}`);
  const group = res.$('.tool-group');
  assert.equal(group.getAttribute('aria-label'), 'Print a day sheet');
  assert.ok(group.querySelector('select') && group.querySelector('[name="printDay"]') && group.querySelector('input[type="checkbox"]'));
});

test('Form tabs: questions, timetable and setup are tabs of one page, and a change in one tab stays when another opens', async () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'reservation', title: 'Seminar', term: 'Fall 2027' }).form;
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.deepEqual(p.$$('.form-tabs a').map((a) => a.textContent.replace('!', '')), ['Responses', 'Questions', 'Timetable', 'Setup']);
  assert.equal(p.$('[name="tab-settings"]').getAttribute('aria-current'), 'page');
  assert.ok(p.$('[name="tab-timetable"] .tab-alert'), 'a timetable with no days asks for attention');
  assert.ok(p.$('[data-panel="Timetable"]').hidden && !p.$('[data-panel="Edit key"]').hidden);

  p.type('[name="keyDays"]', '9');
  p.click('[name="tab-timetable"]');
  assert.equal(p.win.location.hash, `#/f/${f.slug}/timetable`);
  assert.ok(!p.$('[data-panel="Timetable"]').hidden && p.$('[data-panel="Edit key"]').hidden);
  assert.equal(p.$('[name="keyDays"]').value, '9', 'the page was not drawn again');
  p.click('[name="capacity-up"]'); p.click('[name="capacity-up"]'); p.click('[name="capacity-down"]');
  p.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.editKey.days, 9);
  assert.equal(saved.slots.capacity, 2);

  const team = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Teams', term: 'Fall 2027' }).form;
  const q = await openAdmin(w, `#/f/${team.slug}/questions`);
  assert.equal(q.$('[name="tab-timetable"]'), null, 'only a reservation has a timetable');
  assert.deepEqual(q.$$('.q-page [name^="page-title-en-"]').map((n) => n.value), ['About you', 'Study details', 'Team members', 'Project']);
  const responses = await openAdmin(w, `#/f/${team.slug}`);
  assert.equal(responses.$('[name="tab-responses"]').getAttribute('aria-current'), 'page');
});

test('Setup: a section shows what it is set to, and the save bar exists only while there is a change', async () => {
  const w = boot();
  const f = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Teams', term: 'Fall 2027' }).form;
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  const key = p.$('[data-panel="Edit key"]');
  assert.equal(key.querySelector('.panel-head').getAttribute('aria-expanded'), 'false');
  assert.ok(key.querySelector('.panel-body').hidden);
  assert.equal(key.querySelector('.panel-sum').textContent, 'On, 7 days, students can edit and cancel');
  assert.ok(p.$('.savebar').hidden, 'nothing to save yet');
  assert.equal(p.win.App.admin.unsaved, false);

  p.click(key.querySelector('.panel-head'));
  assert.equal(key.querySelector('.panel-body').hidden, false);
  p.type('[name="keyDays"]', '3');
  assert.equal(key.querySelector('.panel-sum').textContent, 'On, 3 days, students can edit and cancel');
  assert.equal(p.$('.savebar').hidden, false);
  assert.equal(p.win.App.admin.unsaved, true);
  p.type('[name="keyDays"]', '7');
  assert.ok(p.$('.savebar').hidden, 'back to the saved value, so there is nothing to save');

  p.type('[name="keyDays"]', '5');
  p.click('[name="save"]'); await settle(12);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.editKey.days, 5);
  assert.ok(p.$('.savebar').hidden);
  assert.equal(p.$('[data-panel="Edit key"] .panel-body').hidden, false, 'a section stays open after a save');

  p.type('[name="teamMin"]', '9');
  p.click('[name="tab-settings"]'); p.click('[name="save"]'); await settle(8);
  assert.equal(p.$('[name="tab-questions"]').getAttribute('aria-current'), 'page', 'a refused save opens the tab and the section with the problem');
  assert.equal(p.$('[data-panel="Team size"] .panel-body').hidden, false);
});

test('Who can register: sections are picked one by one or a whole year group at once', async () => {
  const w = boot();
  const lists = w.admin({ action: 'admin.lists.get' }).lists;
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  const who = p.$('[data-panel="Who can register"]');
  assert.equal(who.querySelector('.panel-sum').textContent, 'Everyone');
  assert.equal(p.$('[name="section-all"]').getAttribute('aria-pressed'), 'true');
  p.click('[name="section-4C-TH1"]'); p.click('[name="section-4C-O2"]');
  assert.equal(who.querySelector('.panel-sum').textContent, '2 sections (4C)');
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sections, ['4C-TH1', '4C-O2']);

  p.click('[name="section-group-4C"]');
  assert.equal(p.$('[name="section-all"]').getAttribute('aria-pressed'), 'true', 'every section chosen is the same as no limit');
  p.click('[name="save"]'); await settle(12);
  assert.deepEqual(w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sections, []);
  assert.ok(lists.sections.length > 2);
});

test('Questions: the admin adds a question to a page, students answer it, and a question moves to another page', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/questions`);
  p.click('[name="add-question-project"]');
  const id = p.$('.q-row.custom').dataset.field;
  p.click('[name="save"]'); await settle(8);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.fields.some((x) => x.custom), false, 'a question with no text is not saved');

  p.type(`[aria-label="English label for ${id}"]`, 'T-shirt size');
  p.pick(`kind-${id}`, 'select');
  p.click('[name="save"]'); await settle(8);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.fields.some((x) => x.custom), false, 'a choice question needs its choices');
  p.type(`[name="choices-${id}"]`, 'Small | صغير\nLarge');
  p.click('[name="page-email"]');
  p.pick('page-email', 'project');
  p.click('[name="save"]'); await settle(12);

  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  const added = saved.fields.find((x) => x.custom);
  assert.deepEqual(JSON.parse(JSON.stringify(added.options)), [{ value: 'Small', label: { en: 'Small', ar: 'صغير' } }, { value: 'Large', label: { en: 'Large', ar: 'Large' } }]);
  const project = saved.steps.find((st) => st.id === 'project').fields;
  assert.deepEqual(project.slice(-2), [id, 'email'], 'the new question and the moved one are on the Project page');
  assert.equal(saved.steps[0].fields.includes('email'), false);

  const data = { ...person({ title: 'Library' }), team_size: '1', members: [] };
  assert.equal(w.api({ action: 'submit', slug: f.slug, data: { ...data, [id]: 'Huge' } }).error.details[id].error, 'invalid_choice');
  const sent = w.api({ action: 'submit', slug: f.slug, data: { ...data, [id]: 'Large' } });
  assert.equal(sent.ok, true);
  const responses = await openAdmin(w, `#/f/${f.slug}`);
  responses.click('[name="details"]'); await settle();
  assert.ok(responses.text().includes('T-shirt size') && responses.text().includes('Large'), 'the answer is in the details of the registration');

  const again = await openAdmin(w, `#/f/${f.slug}/questions`);
  again.click(`[name="remove-${id}"]`);
  again.click('[name="save"]'); await settle(12);
  const after = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(after.fields.some((x) => x.custom), false);
  assert.equal(after.steps.find((st) => st.id === 'project').fields.includes(id), false);
});

test('Pages: the admin adds a page with its title, puts a question on it, renames and reorders pages', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/questions`);
  p.click('[name="add-page"]');
  const page = p.$$('.q-page').pop().dataset.page;
  assert.ok(p.text().includes('Students do not see a page with no questions.'));
  p.click('[name="save"]'); await settle(8);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.steps.length, 4, 'a page with no title is not saved');

  p.type(`[name="page-title-en-${page}"]`, 'Extras');
  p.type(`[name="page-title-ar-${page}"]`, 'إضافات');
  p.click(`[name="add-question-${page}"]`);
  const id = p.$('.q-row.custom').dataset.field;
  p.type(`[aria-label="English label for ${id}"]`, 'Anything else?');
  p.type('[name="page-title-en-you"]', 'Leader');
  p.click(`[name="page-up-${page}"]`);
  assert.equal(p.$(`[name="remove-page-${page}"]`), null, 'a page with a question on it cannot be removed');
  p.click('[name="save"]'); await settle(12);

  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.deepEqual(saved.steps.map((st) => st.title.en), ['Leader', 'Study details', 'Team members', 'Extras', 'Project']);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.steps[3])).fields, [id]);
  assert.equal(saved.steps[3].title.ar, 'إضافات');

  const student = await openPage('index.html', w, { query: `?f=${f.slug}` });
  student.window.App.form.init(); await settle();
  const trail = [...student.window.document.querySelectorAll('.trail-label')].map((n) => n.textContent);
  assert.deepEqual(trail.slice(0, 5), ['Leader', 'Study details', 'Team members', 'Extras', 'Project']);

  const again = await openAdmin(w, `#/f/${f.slug}/questions`);
  again.click(`[name="remove-${id}"]`);
  again.click(`[name="remove-page-${page}"]`);
  again.click('[name="save"]'); await settle(12);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.steps.length, 4);
});

test('Lists: the server refuses a list that does not exist and a question that reads one', () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  assert.equal(w.admin({ action: 'admin.lists.set', key: 'nope', values: ['A'] }).error.code, 'list_not_found');
  assert.equal(w.admin({ action: 'admin.lists.set', key: '_info', values: ['A'] }).error.code, 'list_not_found', 'the info row is not a list');
  const fields = w.admin({ action: 'admin.forms.get', id: f.id }).form.fields.map((x) => (x.id === 'section' ? { ...x, list: 'nope' } : x));
  assert.equal(w.admin({ action: 'admin.forms.update', id: f.id, patch: { fields } }).error.code, 'list_not_found');
  assert.equal(Object.keys(w.admin({ action: 'admin.lists.get' }).lists).includes('_info'), false);
});

test('Clients: a link with an access key shows the link once and the key apart, and the key can be changed or removed', async () => {
  const w = boot();
  w.make('reservation', 'Seminar');
  const p = await openAdmin(w, '#/clients');
  p.click('[name="newClient"]'); await settle(2);
  p.type('[name="clientName"]', 'Dr. Ahmed');
  const all = p.$$('.dialog .check').find((l) => l.textContent.includes('All forms')).querySelector('input');
  all.checked = true; p.fire(all, 'change');
  p.clickText('Create link', p.$('.dialog')); await settle(10);
  const key = p.$('[name="access-key"]').textContent;
  assert.match(key, /^\d{6}$/);
  const token = new URL(p.$('.link-box code').textContent).searchParams.get('t');
  assert.equal(w.api({ action: 'viewer.me', token }).error.code, 'key_needed', 'the link alone opens nothing');
  assert.equal(w.api({ action: 'viewer.me', token, accessKey: key }).client.name, 'Dr. Ahmed');
  p.clickText('Done', p.$('.dialog')); await settle(8);
  assert.ok(p.$('[data-client] [data-label="Access key"]').textContent.includes('Asked'));

  p.click('[name="new-key"]'); await settle(2);
  p.clickText('Make new key', p.$('.overlay')); await settle(10);
  const fresh = p.$('[name="access-key"]').textContent;
  assert.equal(p.$('.dialog .link-box'), null, 'a new key leaves the link as it is');
  assert.equal(w.api({ action: 'viewer.me', token, accessKey: key }).error.code, 'bad_access_key', 'the old key stops working');
  assert.equal(w.api({ action: 'viewer.me', token, accessKey: fresh }).ok, true);
  p.clickText('Done', p.$('.dialog')); await settle(8);
  p.click('[name="remove-key"]'); await settle(2);
  p.clickText('Remove key', p.$('.overlay')); await settle(10);
  assert.equal(w.api({ action: 'viewer.me', token }).ok, true, 'without a key the link opens alone');
  assert.ok(p.$('[data-client] [data-label="Access key"]').textContent.includes('Not asked'));
});

test('Clients: the admin sees a lost key again, and a link ends on its date until it is moved', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, '#/clients');
  p.click('[name="newClient"]'); await settle(2);
  p.type('[name="clientName"]', 'Dr. Ahmed');
  const box = p.$$('.dialog .check').find((l) => l.textContent.includes('Seminar')).querySelector('input');
  box.checked = true; p.fire(box, 'change');
  assert.equal(p.$('[name="link-end-none"]').getAttribute('aria-pressed'), 'true', 'a new link has no end unless one is picked');
  p.click('[name="link-end-date"]'); await settle(1);
  p.clickText('Create link', p.$('.dialog')); await settle(6);
  assert.equal(w.admin({ action: 'admin.clients.list' }).clients.length, 0, 'no link is made while the date is not picked');
  assert.ok(p.$('.dialog .extend-preview').textContent.includes('Pick the date'), 'the reason is next to the picker');
  p.click('[name="link-end-30"]'); await settle(1);
  p.clickText('Create link', p.$('.dialog')); await settle(10);
  const key = p.$('[name="access-key"]').textContent;
  const token = new URL(p.$('.link-box code').textContent).searchParams.get('t');
  p.clickText('Done', p.$('.dialog')); await settle(8);
  const made = w.admin({ action: 'admin.clients.list' }).clients[0];
  assert.equal(Math.round((Date.parse(made.expires) - Date.now()) / 86400000), 30);
  assert.ok(p.$('[data-client] [data-label="Link"]').textContent.includes('Until'));

  p.click('[name="show-key"]'); await settle(8);
  assert.equal(p.$('[name="access-key"]').textContent, key, 'the same key, not a new one');
  assert.equal(p.$('.dialog .link-box'), null, 'the link itself cannot be shown again');
  p.clickText('Done', p.$('.dialog')); await settle(2);

  w.setNow(Date.parse(made.expires) + 86400000);
  p.win.App.admin.render(); await settle(10);
  assert.equal(w.api({ action: 'viewer.me', token, accessKey: key }).error.code, 'link_expired');
  assert.ok(p.$('[data-client] [data-label="Link"]').textContent.includes('Ended'));
  p.click('[name="change-end"]'); await settle(2);
  p.click('[name="link-end-none"]'); await settle(1);
  p.clickText('Save', p.$('.dialog')); await settle(10);
  assert.equal(w.api({ action: 'viewer.me', token, accessKey: key }).ok, true, 'moving the end opens the link again');
  assert.ok(p.$('[data-client] [data-label="Link"]').textContent.includes('No end date'));
  assert.ok(f);
});

test('Setup: Extend keys gives the expired keys, or chosen teams, more time', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  submit(w, f, person({ leader_code: '4230001', title: 'Old', members: [] }));
  w.setNow(w.nowMs + 10 * 86400000);
  submit(w, f, person({ leader_code: '4230002', title: 'Library', members: [] }));
  submit(w, f, person({ leader_code: '4230003', title: 'Clinic', members: [] }));
  const keys = () => w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
  const before = keys();
  const p = await openAdmin(w, '#/f/' + f.slug + '/settings');
  p.click('[data-panel="Edit key"] .panel-head'); await settle(4);
  assert.ok(p.$('.keys-summary').textContent.includes('1 expired'));
  p.click('[name="extend-keys"]'); await settle(8);
  assert.equal(p.$('[name="which-expired"]').getAttribute('aria-pressed'), 'true', 'expired keys are picked first');
  assert.equal(p.$('[name="which-soon"]'), null, 'a filter with nothing in it is not offered');
  assert.equal(p.$('[name="extend-go"]').textContent, 'Extend key');
  p.click('[name="extend-go"]'); await settle(10);
  const after = keys();
  assert.equal(after[0].expired, false);
  assert.equal(after[1].keyExpires, before[1].keyExpires);
  assert.ok(p.$('.keys-summary').textContent.includes('all working'), 'the line is counted again');

  p.click('[name="extend-keys"]'); await settle(8);
  p.click('[name="which-chosen"]'); await settle(1);
  assert.equal(p.$('[name="extend-go"]').disabled, true, 'nothing chosen yet');
  p.type('[name="key-search"]', 'clinic'); await settle(1);
  assert.equal(p.$$('.key-row').length, 1);
  p.click('[name="choose-shown"]'); await settle(1);
  p.click('[name="extend-30"]'); await settle(1);
  assert.ok(p.$('.extend-preview').textContent.includes('will work until'));
  p.click('[name="extend-go"]'); await settle(10);
  const last = keys();
  assert.equal(Date.parse(last[2].keyExpires) - Date.parse(before[2].keyExpires), 30 * 86400000);
  assert.equal(last[1].keyExpires, before[1].keyExpires);
});

test('Responses: a registration shows when its key ends and extends it alone', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  submit(w, f, person({ leader_code: '4230001', title: 'Old', members: [] }));
  submit(w, f, person({ leader_code: '4230002', title: 'Library', members: [] }));
  const before = w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
  const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
  p.clickText('Details', p.$('[data-ref="' + before[0].ref + '"]')); await settle(4);
  assert.ok(p.$('.detail').textContent.includes('Key works'));
  p.click('[name="extend-key"]'); await settle(8);
  assert.equal(p.$('[name="which-all"]'), null, 'only this registration');
  p.click('[name="extend-3"]'); await settle(1);
  p.click('[name="extend-go"]'); await settle(10);
  const after = w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
  assert.equal(Date.parse(after[0].keyExpires) - Date.parse(before[0].keyExpires), 3 * 86400000);
  assert.equal(after[1].keyExpires, before[1].keyExpires);
  assert.ok(p.$('.detail').textContent.includes(new Date(after[0].keyExpires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })), 'the details show the new end');
});

test('Responses: Download all saves every task, shows what was not downloaded, and saves the zip', async () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks', { rules: { driveCheck: 'off' } });
  w.drive.addFile({ id: ID('a'), name: 'clean.pdf', mime: 'application/pdf', bytes: '%PDF' });
  submit(w, f, person({ leader_code: '4230001', title: 'Task 1', link: `https://drive.google.com/file/d/${ID('a')}/view`, members: [] }));
  submit(w, f, person({ leader_code: '4230002', title: 'Forms', link: `https://drive.google.com/file/d/${ID('b')}/view`, members: [] }));
  w.drive.addFile({ id: ID('b'), name: 'Quiz', mime: 'application/vnd.google-apps.form' });
  w.fetch = (url, opts) => {
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(opts.headers.Range).map(Number);
    const buf = w.drive.files.get(/files\/([\w-]+)\?/.exec(url)[1]).buf.slice(from, to + 1);
    return { getResponseCode: () => 206, getContent: () => Array.from(buf) };
  };
  const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
  const saved = [];
  p.win.URL.createObjectURL = (blob) => { saved.push(blob); return 'blob:zip'; };
  p.win.URL.revokeObjectURL = () => {};
  p.win.HTMLAnchorElement.prototype.click = function () {};
  p.click('[name="download-all"]'); await settle(2);
  p.click('[name="download-start"]'); await settle(30);
  assert.ok(p.$('.dialog').textContent.includes('1 file packed'));
  assert.ok(p.$('.download-missed').textContent.includes('cannot be downloaded'), 'the reason is shown with the item');
  p.click('[name="save-part-0"]'); await settle(12);
  assert.equal(saved.length, 1);
  assert.ok(saved[0].size > 100, 'the whole zip is handed to the browser');
});

test('Responses: Download all is not offered before anyone registers', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
  assert.equal(p.$('[name="download-all"]'), null);
});

test('Form header: the same on every tab, and the status is saved where it is changed', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const actions = (p) => p.$$('.page-head > a, .page-head > button, .page-head summary, .page-head [role="menuitem"]').map((n) => n.textContent);
  const responses = await openAdmin(w, `#/f/${f.slug}`);
  const setup = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.deepEqual(actions(responses), ['Open form', 'Copy link', 'More', 'Open Google Sheet', 'Rebuild sheet', 'Duplicate for a new term', 'Delete form']);
  assert.deepEqual(actions(setup), actions(responses));
  assert.equal(responses.$('.toolbar [name="rebuild"]'), null, 'Rebuild sheet is under More, not among the tools');
  responses.click('[name="rebuild"]'); await settle(8);
  assert.ok(responses.text().includes('Google Sheet views rebuilt'));

  assert.equal(responses.$('[name="status"]').value, 'open');
  w.advanceDays(0.001);
  responses.pick('status', 'closed'); await settle(8);
  assert.equal(w.admin({ action: 'admin.forms.get', id: f.id }).form.status, 'closed', 'no Save is needed on Responses');
  assert.ok(responses.text().includes('Status saved: Closed'));

  // On Setup the status is not one of the unsaved changes, and a later Save still passes.
  setup.pick('status', 'draft'); await settle(8);
  assert.ok(setup.$('.head-note').textContent.includes('The status is still Open.'), 'a copy that is out of date is refused, with the reason');
  assert.equal(setup.$('[name="status"]').value, 'open', 'and the saved status is back in the control');
  const fresh = await openAdmin(w, `#/f/${f.slug}/settings`);
  w.advanceDays(0.001);
  fresh.pick('status', 'open'); await settle(8);
  assert.ok(fresh.$('.savebar').hidden, 'nothing waits for Save');
  fresh.type('[name="title"]', 'Projects 2'); fresh.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.deepEqual([saved.status, saved.title], ['open', 'Projects 2']);
});

test('Forms list: grouped by status, a reservation with no days says so, and a first booking is offered only where teams are', async () => {
  const w = boot();
  const teams = w.make('team_registration', 'Projects');
  const chat = w.make('whatsapp_registration', 'Groups');
  const seminar = w.make('reservation', 'Seminar', { slots: { days: [], capacity: 1 } });
  const draft = w.admin({ action: 'admin.forms.create', type: 'task_submission', title: 'Tasks', term: 'Fall 2027' }).form;
  const p = await openAdmin(w);
  assert.deepEqual(p.$$('.form-group').map((g) => [g.dataset.status, g.querySelector('.group-title').textContent]), [['open', 'Open3'], ['draft', 'Draft1']]);
  const card = (f) => p.$(`.card[data-slug="${f.slug}"]`);
  assert.ok(card(draft).closest('[data-status="draft"]'));
  assert.ok(card(seminar).querySelector('[name="no-days"]').getAttribute('href').endsWith('/timetable'), 'the note leads to where days are added');
  assert.ok(card(teams).querySelector('[name="next-booking"]'));
  assert.equal(card(chat).querySelector('[name="next-booking"]'), null, 'a form of single students is not offered a booking');
  assert.equal(card(seminar).querySelector('[name="next-booking"]'), null);
  assert.deepEqual([...card(teams).querySelectorAll('.card-actions > a')].map((a) => a.textContent), ['Responses', 'Setup', 'Open form'], 'the card names the tab as the tab does');
});

test('Team size: the panel counts the saved teams a new range leaves outside, before the save', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  submit(w, f, person({ title: 'Alpha' }));
  submit(w, f, person({ leader_code: '4230010', title: 'Beta', members: [member('سارة خالد حسن علي', '4230011'), member('منى أشرف كمال فؤاد', '4230012')] }));
  const p = await openAdmin(w, `#/f/${f.slug}/questions`);
  const note = () => p.$('[name="size-conflicts"]');
  assert.ok(note().hidden, 'every saved team fits the range');
  p.type('[name="teamMin"]', '2');
  assert.equal(note().hidden, false);
  assert.ok(note().textContent.startsWith('1 saved team is outside 2 to '));
  p.type('[name="teamMin"]', '4'); p.type('[name="teamMax"]', '4');
  assert.ok(note().textContent.startsWith('2 saved teams are outside 4.'));
  p.type('[name="teamMin"]', '2'); p.type('[name="teamMax"]', '5');
  p.click('[name="save"]'); await settle(12);
  assert.equal(p.$$('.toast-err').length, 0, 'the save says nothing the panel did not say');
  assert.ok(note().textContent.startsWith('1 saved team is outside 2 to 5.'), 'the count is still in its panel after the save');
});
