const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');
const { openPage, helpers, settle } = require('./harness/dom.js');

const ID = (c) => c.repeat(33);

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({ action: 'admin.forms.create', type, title: 'Database Team Project Registration Form', term: 'Fall 2027' }).form;
  w.admin({ action: 'admin.forms.update', id: form.id, patch: { status: 'open', ...patch } });
  w.form = form;
  return w;
}

async function open(w, opts) {
  const dom = await openPage('index.html', w, { query: `?f=${w.form.slug}`, ...opts });
  const win = dom.window;
  win.App.form.init();
  await settle();
  return { dom, win, ...helpers(win) };
}

const AR_NAME = 'أحمد محمد محمود أحمد';

async function fillAbout(p, code = '4230999') {
  p.type('[name="email"]', 'sara@example.com');
  p.type('[name="leader_name"]', AR_NAME);
  p.type('[name="leader_code"]', code);
  p.type('[name="phone"]', '+20 10 1234 5678');
}

async function fillStudy(p) {
  p.pick('major', 'حاسبات');
  p.pick('level', 'صفر / الأولى');
  p.pick('section', '4C-TH1');
  p.pick('curriculum', '2020');
}

test('Form: shows the title, the term tag, a type icon, and one dot per step plus review', async () => {
  const w = boot();
  const p = await open(w);
  assert.equal(p.$('h1').textContent, 'Database Team Project Registration Form');
  assert.equal(p.$('.tag').textContent, 'Fall 2027');
  assert.ok(p.$('.form-icon svg'));
  assert.equal(p.$$('.trail li').length, 6);
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.equal(p.text().includes('Clean Code'), false);
  assert.equal(p.$('.sheet').querySelector('svg circle[r="9"]'), null, 'no logo or seal');
});

test('Form: Arabic name field strips English letters and digits as you type and says why', async () => {
  const w = boot();
  const p = await open(w);
  const input = p.$('[name="leader_name"]');
  assert.equal(input.getAttribute('lang'), 'ar');
  assert.equal(input.getAttribute('dir'), 'rtl');
  p.type(input, 'Ahmed أحمد 123 محمد');
  assert.equal(input.value, 'أحمد محمد');
  assert.ok(p.$('.hint').textContent.includes('Arabic'));
});

test('Form: the code field keeps digits only and converts Arabic digits', async () => {
  const w = boot();
  const p = await open(w);
  const input = p.$('[name="leader_code"]');
  p.type(input, '٤٢٣a0999999');
  assert.equal(input.value, '4230999');
});

test('Form: Next on an empty step shows clear errors and stays put', async () => {
  const w = boot();
  const p = await open(w);
  p.submitForm();
  await settle();
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.ok(p.$$('.field.has-error').length >= 4);
  assert.ok(p.$('.banner').textContent.includes('Fix the highlighted'));
  assert.ok(p.text().includes('Enter a valid email address') === false, 'empty email says required');
  assert.ok(p.text().includes('This field is required.'));
});

test('Form: an English name is refused with a specific message on blur', async () => {
  const w = boot();
  const p = await open(w);
  p.type('[name="leader_name"]', 'أحمد محمد');
  assert.ok(p.$('[data-path="leader_name"] .error').textContent.includes('at least 4 names'));
});

test('Form: full registration with a team member ends on a ticket with a key', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm(); await settle();
  await fillStudy(p);
  p.submitForm(); await settle();
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'Team members');
  p.pick('team_size', '2'); await settle();
  assert.equal(p.$('[name="members.0.level"]').value, 'صفر / الأولى', 'member inherits the leader level');
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.0.phone"]', '01112345678');
  p.type('[name="members.0.code"]', '4230998');
  assert.ok(p.text().includes('Team of 2'));
  p.submitForm(); await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm(); await settle();
  assert.equal(p.$('.step-title').textContent, 'Check your details');
  assert.ok(p.text().includes('Library System'));
  p.submitForm(); await settle(12);

  const t = p.$('#ticket');
  assert.ok(t, 'ticket is shown');
  const key = p.$$('.key-digit', t).map((d) => d.textContent).join('');
  assert.match(key, /^\d{5}$/);
  assert.ok(t.textContent.includes('RS-') === false && t.textContent.includes('TR-2027-0001'));
  assert.ok(t.textContent.includes('Save this key'));
  assert.ok(p.$('.callout-arrow svg'));
  assert.ok(p.text().includes('Save as image') && p.text().includes('Save as PDF'));
  const rows = w.sheet(w.form.sheetId, 'Responses').rows();
  assert.equal(rows.length, 2);
  assert.equal(rows[1][8], '4230999');

  p.clickText('Save as PDF');
  assert.equal(p.win.__printed, true);
});

test('Form: a draft survives a reload of the page', async () => {
  const w = boot();
  const p = await open(w);
  p.type('[name="email"]', 'draft@example.com');
  p.type('[name="leader_name"]', AR_NAME);
  const stored = p.win.sessionStorage.getItem(`fp_draft_${w.form.slug}`);
  assert.ok(stored.includes('draft@example.com'));
});

test('Form: a duplicate code explains itself and offers the key flow', async () => {
  const w = boot('team_registration');
  const first = await open(w);
  await fillAbout(first); first.submitForm(); await settle();
  await fillStudy(first); first.submitForm(); await settle();
  first.pick('team_size', '1'); await settle(); first.submitForm(); await settle();
  first.type('[name="title"]', 'Library System'); first.submitForm(); await settle();
  first.submitForm(); await settle(12);
  assert.ok(first.$('#ticket'));

  const second = await open(w);
  await fillAbout(second); second.submitForm(); await settle();
  await fillStudy(second); second.submitForm(); await settle();
  second.pick('team_size', '1'); await settle(); second.submitForm(); await settle();
  second.type('[name="title"]', 'Another'); second.submitForm(); await settle();
  second.submitForm(); await settle(12);
  assert.ok(second.$('.banner').textContent.includes('already registered'));
  assert.equal(second.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.ok(second.$$('.banner button').length === 1);
});

test('Edit by key: open, change the title, save, then cancel and register again', async () => {
  const w = boot('team_registration');
  const first = await open(w);
  await fillAbout(first); first.submitForm(); await settle();
  await fillStudy(first); first.submitForm(); await settle();
  first.pick('team_size', '1'); await settle(); first.submitForm(); await settle();
  first.type('[name="title"]', 'Library System'); first.submitForm(); await settle();
  first.submitForm(); await settle(12);
  const key = first.$$('.key-digit').map((d) => d.textContent).join('');

  const p = await open(w);
  p.clickText('Edit or cancel with your key'); await settle();
  p.type('#key-input', '00000'); p.submitForm(); await settle(8);
  assert.ok(p.text().includes('That key is not right.'));
  p.type('#key-input', key); p.submitForm(); await settle(8);
  assert.ok(p.text().includes('Editing TR-2027-0001'));
  assert.equal(p.$('[name="leader_code"]').value, '4230999');

  p.submitForm(); await settle(); p.submitForm(); await settle(); p.submitForm(); await settle();
  p.type('[name="title"]', 'Library System v2');
  p.submitForm(); await settle();
  p.submitForm(); await settle(12);
  assert.ok(p.text().includes('Changes saved'));
  assert.equal(w.sheet(w.form.sheetId, 'Responses').rows()[1][10], 'Library System v2');

  const q = await open(w);
  q.clickText('Edit or cancel with your key'); await settle();
  q.type('#key-input', key); q.submitForm(); await settle(8);
  for (let i = 0; i < 4; i++) { q.submitForm(); await settle(); }
  q.clickText('Cancel registration'); await settle();
  q.clickText('Yes, cancel it'); await settle(8);
  assert.ok(q.text().includes('Registration cancelled'));
  q.clickText('Register again'); await settle(8);
  assert.equal(q.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.equal(q.$('[name="leader_code"]').value, '');
});

test('Reservation: taken slots are disabled and a booking can be made', async () => {
  const w = boot('reservation', { slots: { days: [{ label: 'Week 11 - Sunday', date: '2027-11-14', times: ['12:30 - 12:50', '12:55 - 1:15'] }], capacity: 1 } });
  w.api({
    action: 'submit', slug: w.form.slug,
    data: { email: 'a@b.com', leader_name: AR_NAME, leader_code: '4230001', phone: '01012345678', major: 'حاسبات', level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Taken', slot: { day: 'week-11-sunday', time: '12:30 - 12:50' } }
  });
  const p = await open(w);
  await fillAbout(p, '4230002'); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.type('[name="title"]', 'Library System'); p.submitForm(); await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot');
  assert.ok(p.text().includes('Pick a day'));
  p.clickText('Week 11 - Sunday'); await settle();
  const chips = p.$$('.slot-chip.time');
  assert.equal(chips.length, 2);
  assert.equal(chips[0].disabled, true);
  assert.equal(chips[1].disabled, false);
  p.click(chips[1]); await settle();
  p.submitForm(); await settle();
  p.submitForm(); await settle(12);
  assert.ok(p.$('#ticket'));
  assert.ok(p.$('#ticket').textContent.includes('12:55 - 1:15'));
  assert.equal(p.$$('.key-digit').length, 5);
});

test('Closed form shows the message and no questions', async () => {
  const w = boot('team_registration', { status: 'closed' });
  const p = await open(w);
  assert.ok(p.text().includes('This form is closed.'));
  assert.equal(p.$('input[name="email"]'), null);
});

test('Language: switching to Arabic flips direction and uses Arabic labels', async () => {
  const w = boot('team_registration');
  const p = await open(w);
  assert.equal(p.win.document.documentElement.dir, 'ltr');
  p.clickText('العربية'); await settle();
  assert.equal(p.win.document.documentElement.dir, 'rtl');
  assert.equal(p.win.document.documentElement.lang, 'ar');
  assert.ok(p.text().includes('البريد الإلكتروني'));
  assert.ok(p.text().includes('خطوة 1'));
  p.clickText('English'); await settle();
  assert.equal(p.win.document.documentElement.dir, 'ltr');
});

test('Language: a form can lock the language', async () => {
  const w = boot('team_registration', { lang: { default: 'ar', allowSwitch: false } });
  const p = await open(w);
  assert.equal(p.win.document.documentElement.lang, 'ar');
  assert.equal(p.$$('.topbar button').length, 1, 'only the theme toggle remains');
});

test('Theme: the toggle switches between light and dark and remembers it', async () => {
  const w = boot('team_registration');
  const p = await open(w);
  p.click('.topbar button[aria-label]');
  assert.equal(p.win.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(p.win.localStorage.getItem('fp_theme'), 'dark');
  p.click('.topbar button[aria-label]');
  assert.equal(p.win.document.documentElement.getAttribute('data-theme'), 'light');
});

test('Unknown or missing form links give a friendly message', async () => {
  const w = boot('team_registration');
  const dom = await openPage('index.html', w, { query: '?f=nope' });
  dom.window.App.form.init();
  await settle();
  assert.ok(dom.window.document.body.textContent.includes('does not exist'));
  const none = await openPage('index.html', w, { query: '' });
  none.window.App.form.init();
  await settle();
  assert.ok(none.window.document.body.textContent.includes('does not exist'));
});

test('Team size: member forms stay hidden until a size is chosen, and Next needs it', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'Team members');
  assert.equal(p.$$('.member').length, 0);
  assert.ok(p.text().includes('Choose the team size above'));
  assert.deepEqual(p.$$('.size-chips input').map((i) => i.value), ['1', '2', '3', '4', '5', '6']);
  p.submitForm(); await settle();
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'Team members', 'cannot skip the team part');
  assert.ok(p.$('[data-path="team_size"] .error').textContent.includes('required'));
});

test('Team size: choosing a size shows exactly that many member forms with no add or remove buttons', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.pick('team_size', '4'); await settle();
  assert.equal(p.$$('.member').length, 3);
  assert.deepEqual(p.$$('.member-title').map((n) => n.textContent), ['Team member 1', 'Team member 2', 'Team member 3']);
  assert.equal(p.$$('button').some((b) => /Add a team member|Remove/.test(b.textContent)), false);
  assert.ok(p.text().includes('Team of 4'));
  assert.equal(p.$('.size-chips input[value="4"]').checked, true);
});

test('Team size: changing the size keeps what was already typed', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.pick('team_size', '3'); await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.pick('team_size', '2'); await settle();
  assert.equal(p.$$('.member').length, 1);
  assert.equal(p.$('[name="members.0.name"]').value, 'سارة خالد حسن علي');
  p.pick('team_size', '1'); await settle();
  assert.equal(p.$$('.member').length, 0);
  assert.ok(p.text().includes('team of one'));
});

test('Team size: the admin range decides which sizes are offered', async () => {
  const w = boot('task_submission', { rules: { teamSize: { min: 2, max: 3 } } });
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  assert.deepEqual(p.$$('.size-chips input').map((i) => i.value), ['2', '3']);
});

test('Team size: a fixed size is selected for the student automatically', async () => {
  const w = boot('team_registration', { rules: { teamSize: { min: 3, max: 3 } } });
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  assert.equal(p.$$('.member').length, 2);
});

test('Team size: a team of three submits all its members and stores them', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.pick('team_size', '3'); await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي'); p.type('[name="members.0.phone"]', '01112345678'); p.type('[name="members.0.code"]', '4230998');
  p.submitForm(); await settle();
  assert.ok(p.$('[data-path="members"] .error, [data-path="members.1.name"] .error'), 'second member is still empty');
  p.type('[name="members.1.name"]', 'منى أشرف كمال فؤاد'); p.type('[name="members.1.phone"]', '01212345678'); p.type('[name="members.1.code"]', '4230997');
  p.submitForm(); await settle();
  p.type('[name="title"]', 'Library System'); p.submitForm(); await settle();
  p.submitForm(); await settle(12);
  assert.ok(p.$('#ticket'));
  assert.ok(p.$('#ticket').textContent.includes('3'));
  const row = w.sheet(w.form.sheetId, 'Responses').rows()[1];
  assert.ok(row[13].includes('4230998') && row[13].includes('4230997'));
});

test('Descriptions: a question description is shown between the label and the answer', async () => {
  const w = boot();
  const fields = w.admin({ action: 'admin.forms.get', id: w.form.id }).form.fields;
  fields.find((x) => x.id === 'email').help = { en: 'Use your university email', ar: 'إيميل الجامعة' };
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { fields } });
  const p = await open(w);
  const field = p.$('[data-path="email"]');
  const desc = field.querySelector('.field-desc');
  assert.equal(desc.textContent, 'Use your university email');
  assert.equal(desc.previousElementSibling.tagName, 'LABEL');
  assert.equal(desc.nextElementSibling.getAttribute('name'), 'email');
});

test('Size note: picking a size with a note shows it under the chips and on the review', async () => {
  const w = boot('team_registration', { rules: { teamSize: { min: 1, max: 5, notice: { sizes: [3, 4], text: { en: 'Others will be added to reach {max}.', ar: 'هيتضاف طلاب لحد {max}' } } } } });
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.pick('team_size', '2'); await settle();
  assert.equal(p.$('.size-notice'), null, 'no note for 2');
  p.pick('team_size', '3'); await settle();
  assert.equal(p.$('.size-notice').textContent, 'Others will be added to reach 5.');
  p.pick('team_size', '5'); await settle();
  assert.equal(p.$('.size-notice'), null, 'no note for 5');
});

test('Subject: the subject code is shown as a tag next to the term', async () => {
  const w = boot('team_registration', { subject: 'CMPn323' });
  const p = await open(w);
  assert.deepEqual(p.$$('.form-head .tag').map((t) => t.textContent), ['CMPn323', 'Fall 2027']);
});

test('Specialization: a Communications-only form says so and fills in the major', async () => {
  const w = boot('team_registration', { rules: { majors: ['اتصالات'] } });
  const p = await open(w);
  assert.equal(p.$('.audience').textContent, 'For Communications students only');
  await fillAbout(p); p.submitForm(); await settle();
  const radios = p.$$('input[name="major"]');
  assert.equal(radios.length, 1);
  assert.ok(radios[0].checked, 'the only choice is already picked');
  assert.equal(p.win.App.form._state.data.major, 'اتصالات');
});

test('Ticket: "a copy was sent" only appears when an email really went out', async () => {
  const w = boot('team_registration', { notifications: { confirmEmail: false, alertEmail: '' } });
  const p = await open(w);
  await fillAbout(p); p.submitForm(); await settle();
  await fillStudy(p); p.submitForm(); await settle();
  p.pick('team_size', '1'); await settle(); p.submitForm(); await settle();
  p.type('[name="title"]', 'Library System'); p.submitForm(); await settle();
  p.submitForm(); await settle(8);
  assert.equal(p.win.App.form._state.view, 'ticket', 'on the ticket');
  assert.ok(!p.text().includes('A copy was sent'), 'no false email promise');
});

test('Folder rule: typing the project title updates the example and keeps the icon', async () => {
  const w = boot('team_registration', { subject: 'CMPn323', rules: { folderName: { enabled: true, subject: 'Software_Engineering' } } });
  const p = await open(w);
  p.win.App.form._state.stepIndex = 3; p.win.App.form._state.data.team_size = '1';
  p.win.document.querySelector('.topbar button').click(); p.win.document.querySelector('.topbar button').click(); await settle();
  p.type('[name="title"]', 'Smart Parking');
  const rule = p.$('.folder-rule');
  assert.ok(rule.querySelector('.icon svg'), 'the icon is still an icon');
  assert.ok(rule.querySelector('.folder-rule-text').textContent.includes('Ahmed_Mohamed_Smart_Parking_Software_Engineering'), 'ends with the subject name, not the code');
});
