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
    const f = w.admin({ action: 'admin.forms.create', type, title, term: 'Fall 2027' }).form;
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
  p.type('#pin', '4321'); p.submitForm(); await settle(10);
  assert.ok(p.text().includes('No forms yet'));
  assert.equal(p.$('.admin-nav a[aria-current="page"]').textContent, 'Forms');
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
  const year = p.$('[name="termYear"]'); year.value = String(new Date().getFullYear() + 1); p.fire(year, 'change');
  p.type('[name="subject"]', 'CMP n323');
  p.submitForm(); await settle(12);
  const forms = w.admin({ action: 'admin.forms.list' }).forms;
  assert.equal(forms.length, 1);
  assert.equal(forms[0].type, 'task_submission');
  assert.equal(forms[0].term, 'Spring ' + (new Date().getFullYear() + 1), 'season chip plus year');
  assert.equal(forms[0].subject, 'CMPn323', 'spaces are removed from the subject code');
  assert.equal(forms[0].status, 'draft');
  assert.ok(p.win.location.hash.endsWith('/settings'));
  assert.ok(p.$('[name="teamMin"]'), 'settings page is showing');
});

test('Create: a title is required', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  p.submitForm(); await settle(4);
  assert.ok(p.text().includes('Give the form a title first.'));
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 0);
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
  const row = p.$('tr[data-field="title"]');
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
  ['team_size', 'members', 'leader_code', 'leader_name'].forEach((id) => {
    const boxes = p.$$(`tr[data-field="${id}"] input[type="checkbox"]`);
    assert.equal(boxes.length, 2, id);
    assert.ok(boxes.every((b) => b.disabled && b.checked), id + ' is locked on');
  });
  assert.equal(p.$('tr[data-field="link"] input[type="checkbox"]').disabled, false, 'the Drive link can be hidden');
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

test('Reservation: add a day, generate its times, save, then bookings appear grouped by day', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  p.click('[name="addDay"]');
  p.type('[name="dayLabel-0"]', 'Week 11 - Sunday');
  const chips = p.$$('.day-card[data-day="0"] .time-chip').map((c) => c.textContent);
  assert.deepEqual(chips.slice(0, 2), ['12:30 - 12:50', '12:55 - 1:15'], 'a new day starts with the session hours');
  p.click('[name="save"]'); await settle(12);
  const days = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots.days;
  assert.equal(days[0].id, 'week-11-sunday');
  assert.ok(days[0].times.length >= 6);

  w.api({ action: 'submit', slug: f.slug, data: person({ title: 'Library', slot: { day: 'week-11-sunday', time: '12:55 - 1:15' } }) });
  const q = await openAdmin(w, `#/f/${f.slug}`);
  const day = q.$('.block.single[data-day="week-11-sunday"]');
  assert.ok(day.textContent.includes('1 booked'));
  assert.ok(day.querySelector('tbody td.mono').textContent.includes('12:55 - 1:15'));
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
  p.clickText('Create link', p.$('.dialog')); await settle(10);
  const link = p.$('.link-box code').textContent;
  assert.ok(link.includes('viewer.html?t='));
  const token = new URL(link).searchParams.get('t');
  const me = w.api({ action: 'viewer.me', token });
  assert.equal(me.client.name, 'Dr. Ahmed');
  assert.deepEqual(me.forms.map((x) => x.slug), [f.slug]);
  assert.deepEqual(w.admin({ action: 'admin.clients.list' }).clients[0].hiddenColumns, ['phone']);
});

test('Lists: editing a list updates the choices every form offers', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, '#/lists');
  // Groups is a plain list, shown as chips; add one with Enter and save.
  p.click('[name="pick-groups"]');
  assert.ok(p.$('.value-chips'), 'plain lists open in the compact view');
  p.type('[name="new-value"]', 'C');
  p.$('[name="new-value"]').dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(p.text().includes('Unsaved changes'));
  p.click('[name="save-list"]'); await settle(8);
  assert.deepEqual(w.admin({ action: 'admin.lists.get' }).lists.groups.map((o) => o.value), ['A', 'B', 'C']);
  // Majors carry English names, so they open as a table; add a named one and reorder.
  p.click('[name="pick-majors"]');
  assert.ok(p.$('[name="en-0"]'), 'named lists open in the table view');
  p.type('[name="new-value"]', 'كهرباء'); p.type('[name="new-en"]', 'Power');
  p.click('[name="add-choice"]');
  p.click('.choice[data-i="2"] [aria-label="Move up"]');
  p.click('[name="save-list"]'); await settle(8);
  const major = w.api({ action: 'getForm', slug: f.slug }).form.fields.find((x) => x.id === 'major');
  assert.deepEqual(major.options.map((o) => o.label.en), ['Computers', 'Power', 'Communications']);
});

test('Lists: the type filter hides lists a kind of form does not use, and each list shows its forms', async () => {
  const w = boot();
  w.make('team_registration', 'Projects');
  const p = await openAdmin(w, '#/lists');
  p.click('[name="type-whatsapp_registration"]');
  assert.equal(p.$('[name="pick-sections"]'), null, 'team sections are hidden for WhatsApp forms');
  assert.ok(p.$('[name="pick-wa_sections"]'));
  p.click('[name="type-team_registration"]');
  assert.equal(p.$('[name="pick-wa_sections"]'), null);
  p.click('[name="pick-levels"]');
  assert.ok(p.$('.used-by').textContent.includes('Projects'), 'used-by names the form');
  assert.equal(p.$('[name="pick-sections"]') && p.$('[name="range-to"]'), null, 'no number filler for non-numeric lists');
  p.click('[name="type-whatsapp_registration"]');
  p.click('[name="pick-wa_sections"]');
  p.type('[name="range-to"]', '3'); p.click('[name="fill-range"]');
  assert.equal(p.$$('.value-chip').length, 3, 'number fill replaces the list');
});

test('Questions: an admin adds a description and students read it under the question', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  assert.ok(p.$('tr[data-desc="link"]').hidden, 'no description yet, so its editor is folded away');
  p.click('[name="desc-link"]');
  assert.equal(p.$('tr[data-desc="link"]').hidden, false);
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
  assert.ok(p.text().includes('Write the team size note'), 'sizes without text are refused');
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
  assert.equal(p.$('[name="termYear"]').value, '2027');
  p.click('[name="season-summer"]');
  p.type('[name="subject"]', 'CMPn336');
  p.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
  assert.equal(saved.term, 'Summer 2027');
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

test('Timetable: session hours, dates that name the day, removing and adding times, copy to next week', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  p.type('[name="pattern-start"]', '10:00'); p.type('[name="pattern-end"]', '11:00');
  p.type('[name="pattern-length"]', '15'); p.type('[name="pattern-gap"]', '0');
  assert.ok(p.text().includes('4 slots a day'), 'live preview counts the slots');
  p.click('[name="addDay"]');
  const date = p.$('[name="dayDate-0"]'); date.value = '2028-03-12'; p.fire(date, 'change');
  assert.equal(p.$('[name="dayLabel-0"]').value, 'Sunday 12 Mar', 'the date names the day');
  p.click('[name="drop-0-3"]');
  p.click('[name="show-add-0"]');
  p.type('[name="add-from-0"]', '11:30'); p.type('[name="add-to-0"]', '11:45'); p.click('[name="add-time-0"]');
  p.click('[name="next-week-0"]');
  assert.equal(p.$('[name="dayLabel-1"]').value, 'Sunday 19 Mar');
  p.click('[name="capacity-up"]');
  p.click('[name="save"]'); await settle(12);
  const slots = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots;
  assert.equal(slots.capacity, 2);
  assert.deepEqual(slots.pattern, { start: '10:00', end: '11:00', length: 15, gap: 0 });
  assert.deepEqual(slots.days.map((d) => [d.date, d.label]), [['2028-03-12', 'Sunday 12 Mar'], ['2028-03-19', 'Sunday 19 Mar']]);
  assert.deepEqual(slots.days[0].times, ['10:00 - 10:15', '10:15 - 10:30', '10:30 - 10:45', '11:30 - 11:45']);
  assert.deepEqual(slots.days[1].times, slots.days[0].times, 'the copy keeps the edited times');
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
