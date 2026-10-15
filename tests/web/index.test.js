const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../harness/appsscript-mock.js');
const { openPage, helpers, settle } = require('../harness/dom.js');

const ID = (c) => c.repeat(33);

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Database Team Project Registration Form',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  return w;
}

async function open(w, opts) {
  const dom = await openPage('index.html', w, {
    query: `?f=${w.form.slug}`,
    ...opts
  });
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
  assert.equal(
    p.$('h1').textContent,
    'Database Team Project Registration Form'
  );
  assert.equal(p.$('.tag').textContent, 'Fall 2027');
  assert.ok(p.$('.form-icon svg'));
  assert.equal(p.$$('.trail li').length, 6);
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.equal(p.text().includes('Clean Code'), false);
  assert.equal(
    p.$('.sheet').querySelector('svg circle[r="9"]'),
    null,
    'no logo or seal'
  );
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
  assert.ok(
    p.text().includes('Enter a valid email address') === false,
    'empty email says required'
  );
  assert.ok(p.text().includes('This field is required.'));
});

test('Form: an English name is refused with a specific message on blur', async () => {
  const w = boot();
  const p = await open(w);
  p.type('[name="leader_name"]', 'أحمد محمد');
  assert.ok(
    p
      .$('[data-path="leader_name"] .error')
      .textContent.includes('at least 4 names')
  );
});

test('Form: full registration with a team member ends on a ticket with a key', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  assert.equal(
    p.$('.trail .is-current .trail-label').textContent,
    'Team members'
  );
  p.pick('team_size', '2');
  await settle();
  assert.equal(
    p.$('[name="members.0.level"]').value,
    'صفر / الأولى',
    'member inherits the leader level'
  );
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.0.phone"]', '01112345678');
  p.type('[name="members.0.code"]', '4230998');
  assert.ok(p.text().includes('Team of 2'));
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  assert.equal(p.$('.step-title').textContent, 'Check your details');
  assert.ok(p.text().includes('Library System'));
  p.submitForm();
  await settle(12);

  const t = p.$('#ticket');
  assert.ok(t, 'ticket is shown');
  const key = p
    .$$('.key-digit', t)
    .map((d) => d.textContent)
    .join('');
  assert.match(key, /^\d{5}$/);
  assert.equal(
    p.$('.key-digits .sr-only', t).textContent,
    key.split('').join(' '),
    'a screen reader hears the key digit by digit'
  );
  assert.equal(p.$('.key-digits', t).getAttribute('role'), null);
  assert.ok(
    t.textContent.includes('RS-') === false &&
      t.textContent.includes('TR-2027-0001')
  );
  assert.ok(t.textContent.includes('Save this key'));
  assert.ok(p.$('.callout-arrow svg'));
  assert.ok(
    p.text().includes('Save as image') && p.text().includes('Save as PDF')
  );
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
  await fillAbout(first);
  first.submitForm();
  await settle();
  await fillStudy(first);
  first.submitForm();
  await settle();
  first.pick('team_size', '1');
  await settle();
  first.submitForm();
  await settle();
  first.type('[name="title"]', 'Library System');
  first.submitForm();
  await settle();
  first.submitForm();
  await settle(12);
  assert.ok(first.$('#ticket'));

  const second = await open(w);
  await fillAbout(second);
  second.submitForm();
  await settle();
  await fillStudy(second);
  second.submitForm();
  await settle();
  second.pick('team_size', '1');
  await settle();
  second.submitForm();
  await settle();
  second.type('[name="title"]', 'Another');
  second.submitForm();
  await settle();
  second.submitForm();
  await settle(12);
  assert.ok(second.$('.banner').textContent.includes('already registered'));
  assert.equal(
    second.$('.trail .is-current .trail-label').textContent,
    'About you'
  );
  assert.ok(second.$$('.banner button').length === 1);
});

test('Edit by key: open, change the title, save, then cancel and register again', async () => {
  const w = boot('team_registration');
  const first = await open(w);
  await fillAbout(first);
  first.submitForm();
  await settle();
  await fillStudy(first);
  first.submitForm();
  await settle();
  first.pick('team_size', '1');
  await settle();
  first.submitForm();
  await settle();
  first.type('[name="title"]', 'Library System');
  first.submitForm();
  await settle();
  first.submitForm();
  await settle(12);
  const key = first
    .$$('.key-digit')
    .map((d) => d.textContent)
    .join('');

  const p = await open(w);
  p.clickText('Edit or cancel with your key');
  await settle();
  p.type('#key-input', '00000');
  p.submitForm();
  await settle(8);
  assert.ok(p.text().includes('That key is not right.'));
  p.type('#key-input', key);
  p.submitForm();
  await settle(8);
  assert.ok(p.text().includes('Editing TR-2027-0001'));
  assert.equal(
    p.$('#step-title').textContent,
    'Your registration',
    'a key opens the summary, not the first page'
  );
  assert.ok(
    p.text().includes('4230999') && p.text().includes('Library System')
  );
  assert.equal(p.$('.trail'), null, 'the summary is not a step of a path');
  assert.equal(
    p.$('button[type="submit"]'),
    null,
    'nothing is changed, so there is nothing to save'
  );
  assert.ok(p.text().includes('Nothing is changed yet.'));

  p.click(p.$$('.review-group .link-btn')[3]);
  await settle();
  assert.equal(p.$('button[type="submit"]').textContent, 'Done');
  p.type('[name="title"]', 'x');
  p.submitForm();
  await settle();
  assert.ok(
    p.$('.field.has-error'),
    'a page with a mistake does not go back to the summary'
  );
  p.type('[name="title"]', 'Library System v2');
  p.submitForm();
  await settle();
  assert.equal(p.$('#step-title').textContent, 'Your registration');
  assert.equal(p.$('button[type="submit"]').textContent, 'Save changes');
  p.submitForm();
  await settle(12);
  assert.ok(p.text().includes('Changes saved'));
  assert.equal(
    w.sheet(w.form.sheetId, 'Responses').rows()[1][10],
    'Library System v2'
  );

  const q = await open(w);
  q.clickText('Edit or cancel with your key');
  await settle();
  q.type('#key-input', key);
  q.submitForm();
  await settle(8);
  q.clickText('Cancel registration');
  await settle();
  q.clickText('Yes, cancel it');
  await settle(8);
  assert.ok(q.text().includes('Registration cancelled'));
  q.clickText('Register again');
  await settle(8);
  assert.equal(q.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.equal(q.$('[name="leader_code"]').value, '');
});

test('Reservation: optional teammates can be added, validated, and included on the ticket', async () => {
  const w = boot('reservation', {
    slots: {
      days: [
        {
          label: 'Week 11 - Sunday',
          date: '2027-11-14',
          times: ['12:30 - 12:50']
        }
      ],
      capacity: 1
    }
  });
  const f = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: {
      fields: f.fields.map((field) =>
        field.role === 'members'
          ? { ...field, enabled: true, required: true }
          : field
      ),
      steps: f.steps.map((step) =>
        step.id === 'project'
          ? { ...step, fields: step.fields.concat(['members']) }
          : step
      )
    }
  });
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  p.clickText('Add a team member');
  await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.0.phone"]', '01112345678');
  p.type('[name="members.0.code"]', '4230002');
  p.pick('members.0.level', 'صفر / الأولى');
  p.pick('members.0.curriculum', '2020');
  p.pick('members.0.section', '4C-TH1');
  p.submitForm();
  await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot');
  p.clickText('Week 11 - Sunday');
  await settle();
  p.click(p.$('.slot-chip.time'));
  await settle();
  p.submitForm();
  await settle();
  assert.ok(p.text().includes('Check your details'));
  assert.ok(
    p.text().includes('سارة خالد حسن علي'),
    'the summary before booking lists the teammate'
  );
  p.submitForm();
  await settle(12);
  assert.ok(p.$('#ticket'));
  assert.ok(p.$('#ticket').textContent.includes('سارة خالد حسن علي'));
  const saved = w.admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions[0];
  assert.deepEqual(saved.data.members, [
    {
      name: 'سارة خالد حسن علي',
      phone: '01112345678',
      code: '4230002',
      level: 'صفر / الأولى',
      curriculum: '2020',
      section: '4C-TH1'
    }
  ]);
});

test('Reservation: taken slots are disabled and a booking can be made', async () => {
  const w = boot('reservation', {
    slots: {
      days: [
        {
          label: 'Week 11 - Sunday',
          date: '2027-11-14',
          times: ['12:30 - 12:50', '12:55 - 1:15']
        }
      ],
      capacity: 1
    }
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@b.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      title: 'Taken',
      slot: { day: 'week-11-sunday', time: '12:30 - 12:50' }
    }
  });
  const p = await open(w);
  await fillAbout(p, '4230002');
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  assert.equal(p.$('.step-title').textContent, 'Time slot');
  assert.ok(p.text().includes('Pick a day'));
  assert.ok(
    p.$('.slot-days .slot-chip').textContent.includes('1 left'),
    'a day says its places left before it is picked'
  );
  p.clickText('Week 11 - Sunday');
  await settle();
  const chips = p.$$('.slot-chip.time');
  assert.equal(chips.length, 2);
  assert.equal(chips[0].disabled, true);
  assert.ok(
    chips[0].classList.contains('is-full') &&
      chips[0].textContent.includes('Fully booked')
  );
  assert.equal(chips[1].disabled, false);
  p.click(chips[1]);
  await settle();
  p.submitForm();
  await settle();
  p.submitForm();
  await settle(12);
  assert.ok(p.$('#ticket'));
  assert.ok(
    p.$('#ticket [name="when"]').textContent.includes('12:55 - 1:15'),
    'the time is drawn on a clock'
  );
  assert.ok(
    p.$('#ticket [name="when"]').textContent.includes('14'),
    'and the day on a calendar'
  );
  assert.deepEqual(
    [...p.$$('#ticket [name="when"] img')].map((i) => i.getAttribute('src')),
    ['assets/img/pirate.webp', 'assets/img/parrot.webp'],
    'with the pirate and the parrot'
  );
  assert.deepEqual(
    [...p.win.App.ticket.handAngles('12:55 - 1:15')],
    [27.5, 330],
    'the hands point at 12:55'
  );
  assert.deepEqual(
    [...p.win.App.ticket.slotArc('12:55 - 1:15')],
    [330, 450],
    'the slice runs from 55 past the minute round to 15'
  );
  assert.deepEqual(
    [...p.win.App.ticket.slotArc('10:00 - 11:30')],
    [300, 345],
    'a slot of more than an hour is marked on the hours'
  );
  assert.equal(
    p.$$('.key-digit').length,
    5,
    'a booking made by hand keeps its own key on the ticket'
  );
});

test('Reservation teammates: the note for a number of teammates shows once the leader has added that many', async () => {
  const w = boot('reservation', {
    slots: {
      days: [
        {
          label: 'Week 11 - Sunday',
          date: '2027-11-14',
          times: ['12:30 - 12:50']
        }
      ],
      capacity: 1
    }
  });
  const fields = w.admin({ action: 'admin.forms.get', id: w.form.id }).form
    .fields;
  Object.assign(
    fields.find((x) => x.role === 'members'),
    {
      enabled: true,
      required: false,
      min: 0,
      max: 2,
      notice: {
        sizes: [1, 7],
        text: { en: 'Other students may join you, up to {max}.', ar: '' }
      }
    }
  );
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { fields } });
  const saved = w
    .api({ action: 'getForm', slug: w.form.slug })
    .form.fields.find((x) => x.role === 'members');
  assert.deepEqual(
    saved.notice.sizes,
    [1],
    'a number outside 0 to 2 is dropped'
  );
  const p = await open(w);
  await fillAbout(p, '4230002');
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  assert.equal(
    p.$('.members-wrap .size-notice'),
    null,
    'no note for a leader alone'
  );
  p.click('[name="add-member"]');
  await settle();
  assert.equal(
    p.$('.members-wrap .size-notice').textContent,
    'Other students may join you, up to 2.'
  );
  p.click('[name="add-member"]');
  await settle();
  assert.equal(p.$('.members-wrap .size-notice'), null, 'and none for two');
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
  p.clickText('العربية');
  await settle();
  assert.equal(p.win.document.documentElement.dir, 'rtl');
  assert.equal(p.win.document.documentElement.lang, 'ar');
  assert.ok(p.text().includes('البريد الإلكتروني'));
  assert.ok(p.text().includes('خطوة 1'));
  p.clickText('English');
  await settle();
  assert.equal(p.win.document.documentElement.dir, 'ltr');
});

test('Language: a form can lock the language', async () => {
  const w = boot('team_registration', {
    lang: { default: 'ar', allowSwitch: false }
  });
  const p = await open(w);
  assert.equal(p.win.document.documentElement.lang, 'ar');
  assert.equal(
    p.$$('.topbar button').length,
    1,
    'only the theme toggle remains'
  );
});

test('Theme: the toggle switches between light and dark and remembers it', async () => {
  const w = boot('team_registration');
  const p = await open(w);
  p.click('.topbar button[aria-label]');
  assert.equal(
    p.win.document.documentElement.getAttribute('data-theme'),
    'dark'
  );
  assert.equal(p.win.localStorage.getItem('fp_theme'), 'dark');
  p.click('.topbar button[aria-label]');
  assert.equal(
    p.win.document.documentElement.getAttribute('data-theme'),
    'light'
  );
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
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  assert.equal(
    p.$('.trail .is-current .trail-label').textContent,
    'Team members'
  );
  assert.equal(p.$$('.member').length, 0);
  assert.ok(p.text().includes('Choose the team size above'));
  assert.deepEqual(
    p.$$('.size-chips input').map((i) => i.value),
    ['1', '2', '3', '4', '5', '6']
  );
  p.submitForm();
  await settle();
  assert.equal(
    p.$('.trail .is-current .trail-label').textContent,
    'Team members',
    'cannot skip the team part'
  );
  assert.ok(
    p.$('[data-path="team_size"] .error').textContent.includes('required')
  );
});

test('Team size: choosing a size shows exactly that many member forms', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '4');
  await settle();
  assert.equal(p.$$('.member').length, 3);
  assert.deepEqual(
    p.$$('.member-title').map((n) => n.textContent),
    ['Team member 1', 'Team member 2', 'Team member 3']
  );
  assert.ok(p.text().includes('Team of 4'));
  assert.equal(p.$('.size-chips input[value="4"]').checked, true);
});

test('Team members: remove takes that member out and lowers the size, Undo brings it back, add raises the size', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '3');
  await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.1.name"]', 'منى أشرف كمال فؤاد');

  p.click('[name="remove-member-0"]');
  await settle();
  assert.equal(p.$$('.member').length, 1);
  assert.equal(
    p.$('[name="members.0.name"]').value,
    'منى أشرف كمال فؤاد',
    'the member that was chosen left, not the last one'
  );
  assert.equal(p.$('.size-chips input[value="2"]').checked, true);
  assert.ok(p.text().includes('Team member 1 was removed.'));

  p.click('[name="undo-remove"]');
  await settle();
  assert.deepEqual(
    [0, 1].map((i) => p.$(`[name="members.${i}.name"]`).value),
    ['سارة خالد حسن علي', 'منى أشرف كمال فؤاد']
  );
  assert.equal(p.$('.size-chips input[value="3"]').checked, true);

  p.click('[name="add-member"]');
  await settle();
  assert.equal(p.$$('.member').length, 3);
  assert.equal(p.$('.size-chips input[value="4"]').checked, true);
  assert.equal(p.$('[name="members.2.name"]').value, '');

  const range = w.api({ action: 'getForm', slug: w.form.slug }).form.rules
    .teamSize;
  p.pick('team_size', String(range.max));
  await settle();
  assert.equal(
    p.$('[name="add-member"]'),
    null,
    'a full team has no add button'
  );
  p.pick('team_size', String(range.min));
  await settle();
  assert.equal(
    p.$('[name^="remove-member"]'),
    null,
    'the smallest team has no remove button'
  );
});

test('Team size: changing the size keeps what was already typed', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '3');
  await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.pick('team_size', '2');
  await settle();
  assert.equal(p.$$('.member').length, 1);
  assert.equal(p.$('[name="members.0.name"]').value, 'سارة خالد حسن علي');
  p.pick('team_size', '1');
  await settle();
  assert.equal(p.$$('.member').length, 0);
  assert.ok(p.text().includes('team of one'));
});

test('Team size: the admin range decides which sizes are offered', async () => {
  const w = boot('task_submission', {
    rules: { teamSize: { min: 2, max: 3 } }
  });
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  assert.deepEqual(
    p.$$('.size-chips input').map((i) => i.value),
    ['2', '3']
  );
});

test('Team size: a fixed size is selected for the student automatically', async () => {
  const w = boot('team_registration', {
    rules: { teamSize: { min: 3, max: 3 } }
  });
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  assert.equal(p.$$('.member').length, 2);
});

test('Team size: a team of three submits all its members and stores them', async () => {
  const w = boot();
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '3');
  await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.0.phone"]', '01112345678');
  p.type('[name="members.0.code"]', '4230998');
  p.submitForm();
  await settle();
  assert.ok(
    p.$('[data-path="members"] .error, [data-path="members.1.name"] .error'),
    'second member is still empty'
  );
  p.type('[name="members.1.name"]', 'منى أشرف كمال فؤاد');
  p.type('[name="members.1.phone"]', '01212345678');
  p.type('[name="members.1.code"]', '4230997');
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  p.submitForm();
  await settle(12);
  assert.ok(p.$('#ticket'));
  assert.ok(p.$('#ticket').textContent.includes('3'));
  const row = w.sheet(w.form.sheetId, 'Responses').rows()[1];
  assert.ok(row[13].includes('4230998') && row[13].includes('4230997'));
});

test('Descriptions: a question description is shown between the label and the answer', async () => {
  const w = boot();
  const fields = w.admin({ action: 'admin.forms.get', id: w.form.id }).form
    .fields;
  fields.find((x) => x.id === 'email').help = {
    en: 'Use your university email',
    ar: 'إيميل الجامعة'
  };
  w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { fields } });
  const p = await open(w);
  const field = p.$('[data-path="email"]');
  const desc = field.querySelector('.field-desc');
  assert.equal(desc.textContent, 'Use your university email');
  assert.equal(desc.previousElementSibling.tagName, 'LABEL');
  assert.equal(desc.nextElementSibling.getAttribute('name'), 'email');
});

test('Size note: picking a size with a note shows it under the chips and on the review', async () => {
  const w = boot('team_registration', {
    rules: {
      teamSize: {
        min: 1,
        max: 5,
        notice: {
          sizes: [3, 4],
          text: {
            en: 'Others will be added to reach {max}.',
            ar: 'هيتضاف طلاب لحد {max}'
          }
        }
      }
    }
  });
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '2');
  await settle();
  assert.equal(p.$('.size-notice'), null, 'no note for 2');
  p.pick('team_size', '3');
  await settle();
  assert.equal(
    p.$('.size-notice').textContent,
    'Others will be added to reach 5.'
  );
  p.pick('team_size', '5');
  await settle();
  assert.equal(p.$('.size-notice'), null, 'no note for 5');
});

test('Subject: the subject code is shown as a tag next to the term', async () => {
  const w = boot('team_registration', { subject: 'CMPn323' });
  const p = await open(w);
  assert.deepEqual(
    p.$$('.form-head .tag').map((t) => t.textContent),
    ['CMPn323', 'Fall 2027']
  );
});

test('WhatsApp: the public form shows only the batch year in its title and metadata', async () => {
  const w = boot('whatsapp_registration', { batchYear: '2028/2029' });
  const p = await open(w);
  assert.equal(
    p.win.document.title,
    'Database Team Project Registration Form - Batch 2028/2029'
  );
  assert.deepEqual(
    p.$$('.form-head .tag').map((tag) => tag.textContent),
    ['Batch 2028/2029']
  );
  assert.equal(p.$('.form-head .tag-subject'), null);
});

test('Specialization: a Communications-only form says so and fills in the major', async () => {
  const w = boot('team_registration', { rules: { majors: ['اتصالات'] } });
  const p = await open(w);
  assert.equal(
    p.$('.audience').textContent,
    'For Communications students only'
  );
  await fillAbout(p);
  p.submitForm();
  await settle();
  const radios = p.$$('input[name="major"]');
  assert.equal(radios.length, 1);
  assert.ok(radios[0].checked, 'the only choice is already picked');
  assert.equal(p.win.App.form._state.data.major, 'اتصالات');
});

test('Ticket: "a copy was sent" only appears when an email really went out', async () => {
  const w = boot('team_registration', {
    notifications: { confirmEmail: false, alertEmail: '' }
  });
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '1');
  await settle();
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  p.submitForm();
  await settle(8);
  assert.equal(p.win.App.form._state.view, 'ticket', 'on the ticket');
  assert.ok(!p.text().includes('A copy was sent'), 'no false email promise');
});

test('Folder rule: typing the project title updates the example and keeps the icon', async () => {
  const w = boot('team_registration', {
    subject: 'CMPn323',
    rules: { folderName: { enabled: true, subject: 'Software_Engineering' } }
  });
  const p = await open(w);
  p.win.App.form._state.stepIndex = 3;
  p.win.App.form._state.data.team_size = '1';
  p.win.document.querySelector('.topbar button').click();
  p.win.document.querySelector('.topbar button').click();
  await settle();
  p.type('[name="title"]', 'Smart Parking');
  const rule = p.$('.folder-rule');
  assert.ok(rule.querySelector('.icon svg'), 'the icon is still an icon');
  assert.ok(
    rule
      .querySelector('.folder-rule-text')
      .textContent.includes('Ahmed_Mohamed_Smart_Parking_Software_Engineering'),
    'ends with the subject name, not the code'
  );
});

test('Route: a sea of islands, and the ship sails from island to island toward the treasure', async () => {
  const w = boot();
  const p = await open(w);
  const steps = p.$$('.trail li:not(.trail-x)').length;
  const at = (i) => (((i + 0.5) * 100) / (steps + 1)).toFixed(3) + '%';
  const ship = () =>
    Object.fromEntries(
      p
        .$('.trail-sea .trail-ship')
        .getAttribute('style')
        .split(';')
        .map((d) => d.split(':'))
    );
  assert.equal(
    p.$$('.trail li .isle img[src="assets/img/island.svg"]').length,
    steps + 1,
    'an island for each step and the treasure island'
  );
  assert.ok(
    p.$(
      '.trail li:last-child.trail-x .isle img.trail-treasure[src="assets/img/treasure.svg"]'
    ),
    'the treasure waits on the last island'
  );
  assert.ok(p.$('.trail-x .isle .icon-x'), 'beside the X');
  assert.equal(p.$$('.trail-ship').length, 1);
  assert.ok(p.$('.trail-ship img[src="assets/img/ship.svg"]'));
  assert.deepEqual(
    ship(),
    { '--at': at(0), '--from': at(0) },
    'the ship starts at the first island'
  );
  await fillAbout(p);
  p.submitForm();
  await settle();
  assert.equal(p.$$('.trail-ship').length, 1);
  assert.deepEqual(
    ship(),
    { '--at': at(1), '--from': at(0) },
    'and sails from the first island to the second'
  );
});

/** A form that lets a leader ask for a member of another team, with team A (two members) saved. */
function bootTransfers() {
  const w = boot();
  const rules = w.admin({ action: 'admin.forms.get', id: w.form.id }).form
    .rules;
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: { rules: { ...rules, transfers: true } }
  });
  const mate = (name, code) => ({
    name,
    phone: '01112345678',
    code,
    level: 'صفر / الأولى',
    curriculum: '2020',
    section: '4C-TH1'
  });
  w.teamA = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@example.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      title: 'Compiler',
      team_size: '3',
      members: [
        mate('سارة خالد حسن علي', '4230002'),
        mate('منى سعيد فؤاد علي', '4230003')
      ]
    }
  });
  return w;
}

/** Registers team B from the page with one member, and stops on the review page. */
async function teamBWith(w, code) {
  const p = await open(w);
  await fillAbout(p);
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.pick('team_size', '2');
  await settle();
  p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
  p.type('[name="members.0.phone"]', '01112345678');
  p.type('[name="members.0.code"]', code);
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Library System');
  p.submitForm();
  await settle();
  return p;
}

async function openWithKey(w, key) {
  const p = await open(w);
  p.clickText('Edit or cancel with your key');
  await settle();
  p.type('#key-input', key);
  p.submitForm();
  await settle(10);
  return p;
}

test('Transfer: a member of another team can be asked for, and the team registers without them', async () => {
  const w = bootTransfers();
  const p = await teamBWith(w, '4230002');
  p.submitForm();
  await settle(12);
  const dialog = p.$('.overlay .dialog');
  assert.ok(dialog.textContent.includes('Already in another team'));
  assert.ok(
    dialog.textContent.includes(`سارة خالد حسن علي (4230002) → ${w.teamA.ref}`),
    'the popup names the member and the team by its reference'
  );
  p.clickText('Go back', dialog);
  await settle(4);
  assert.equal(p.$('#ticket'), null, 'declining registers nothing');
  assert.ok(
    p
      .text()
      .includes('Someone in this team is already registered in another team.')
  );
  assert.equal(
    p.$('.trail .is-current .trail-label').textContent,
    'Team members',
    'and returns to the members'
  );

  p.submitForm();
  await settle();
  p.submitForm();
  await settle();
  p.submitForm();
  await settle(12);
  p.clickText('Ask the leader', p.$('.overlay .dialog'));
  await settle(14);
  assert.ok(p.$('#ticket'), 'the team is registered');
  assert.ok(
    p
      .$('[name="transfer-sent"]')
      .textContent.includes('Request sent: سارة خالد حسن علي (4230002)')
  );
  const rows = w.admin({ action: 'admin.submissions', slug: w.form.slug });
  assert.deepEqual(rows.submissions[1].data.members, []);
  assert.equal(rows.transfers.length, 1);

  const key = p
    .$$('.key-digit')
    .map((d) => d.textContent)
    .join('');
  const b = await openWithKey(w, key);
  assert.ok(
    b
      .$('[data-transfer="pending"]')
      .textContent.includes(
        `Waiting for team ${w.teamA.ref} to release سارة خالد حسن علي (4230002).`
      )
  );
  b.click('[name="transfer-cancel"]');
  await settle(8);
  assert.equal(b.$('.transfer-notes'), null, 'a cancelled request is gone');
  assert.equal(
    w.admin({ action: 'admin.submissions', slug: w.form.slug }).transfers
      .length,
    0
  );
});

test('Transfer: the leader who holds the member is asked when the registration opens, and approving moves the member', async () => {
  const w = bootTransfers();
  const p = await teamBWith(w, '4230002');
  p.submitForm();
  await settle(12);
  p.clickText('Ask the leader', p.$('.overlay .dialog'));
  await settle(14);
  const keyB = p
    .$$('.key-digit')
    .map((d) => d.textContent)
    .join('');

  const a = await openWithKey(w, w.teamA.key);
  const dialog = a.$('.overlay .dialog');
  assert.ok(dialog.textContent.includes('A team asks for one of your members'));
  assert.ok(
    dialog.textContent.includes(
      'asks for سارة خالد حسن علي (4230002) to move to it.'
    )
  );
  assert.ok(
    dialog.textContent.includes('If you approve, you will be a team of 2.')
  );
  a.click('[name="transfer-later"]');
  await settle(4);
  assert.equal(a.$('.overlay'), null);
  assert.ok(
    a.$('[data-transfer="incoming"]'),
    'a request left for later stays above the registration'
  );

  a.click('[name="transfer-answer"]');
  await settle(4);
  a.click('[name="transfer-approve"]');
  await settle(12);
  assert.equal(a.$('.transfer-notes'), null);
  assert.ok(a.text().includes('سارة خالد حسن علي (4230002) moved to team'));
  assert.equal(
    a.text().includes('4230002)') &&
      a.$$('.review-group').some((g) => g.textContent.includes('4230002')),
    false,
    'the member left this registration'
  );
  const rows = w.admin({
    action: 'admin.submissions',
    slug: w.form.slug
  }).submissions;
  assert.deepEqual(
    rows.map((r) => r.data.members.map((m) => m.code)),
    [['4230003'], ['4230002']]
  );

  const b = await openWithKey(w, keyB);
  assert.ok(
    b
      .$('[data-transfer="approved"]')
      .textContent.includes('سارة خالد حسن علي (4230002) joined your team.')
  );
  assert.ok(
    b.$$('.review-group').some((g) => g.textContent.includes('4230002'))
  );
});

test('Transfer: rejecting keeps the member on the team', async () => {
  const w = bootTransfers();
  const p = await teamBWith(w, '4230003');
  p.submitForm();
  await settle(12);
  p.clickText('Ask the leader', p.$('.overlay .dialog'));
  await settle(14);
  const a = await openWithKey(w, w.teamA.key);
  a.click('[name="transfer-reject"]');
  await settle(12);
  assert.ok(
    a.text().includes('منى سعيد فؤاد علي (4230003) stays on your team.')
  );
  assert.equal(
    w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions[0]
      .data.members.length,
    2
  );
});

test('Transfer: a leader who is asked for names the new leader, moves, and is told to pass the key on', async () => {
  const w = bootTransfers();
  const p = await teamBWith(w, '4230001');
  p.submitForm();
  await settle(12);
  const offer = p.$('.overlay .dialog');
  assert.ok(
    offer.textContent.includes(`(4230001) → ${w.teamA.ref} (leads that team)`),
    'the popup says the student leads that team'
  );
  assert.ok(
    offer.textContent.includes(
      'A leader who agrees hands their team to one of its members first.'
    )
  );
  p.clickText('Ask the leader', offer);
  await settle(14);
  const refB = w.admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions[1].ref;

  const a = await openWithKey(w, w.teamA.key);
  const dialog = a.$('.overlay .dialog');
  assert.ok(dialog.textContent.includes('A team asks for you'));
  assert.ok(
    dialog.textContent.includes(
      `Team ${refB} asks for you to move to it. You lead this team, so choose who leads it after you.`
    )
  );
  assert.ok(
    dialog.textContent.includes('After you move, this is a team of 2.')
  );
  assert.deepEqual(
    a.$$('[name="handover-leader"]', dialog).map((r) => [r.value, r.checked]),
    [
      ['4230002', false],
      ['4230003', false]
    ]
  );
  assert.equal(
    a.$('[name="transfer-approve"]').textContent,
    'Hand over and move'
  );

  a.click('[name="transfer-approve"]');
  await settle(4);
  assert.ok(a.$('.overlay'), 'nothing is sent until the question is answered');
  assert.deepEqual(
    a.$$('.handover .error').map((e) => e.textContent),
    ['Choose the new leader.', 'This field is required.']
  );
  a.pick('handover-leader', '4230003');
  a.type('[name="handover-email"]', 'not an email');
  a.click('[name="transfer-approve"]');
  await settle(4);
  assert.deepEqual(
    a.$$('.handover .error').map((e) => [e.hidden, e.textContent]),
    [
      [true, ''],
      [false, 'Enter a valid email address.']
    ]
  );
  assert.equal(
    a.$('[name="handover-email"]').value,
    'not an email',
    'a refused email stays in its field'
  );

  a.type('[name="handover-email"]', 'mona@example.com');
  a.click('[name="transfer-approve"]');
  await settle(12);
  assert.equal(a.$('.overlay'), null);
  assert.ok(a.text().includes(`You moved to team ${refB}`));
  assert.ok(
    a
      .$('[name="moved-note"]')
      .textContent.includes(
        `منى سعيد فؤاد علي (4230003) leads team ${w.teamA.ref} now. Give them its edit key, ${w.teamA.key}.`
      )
  );
  const rows = w.admin({
    action: 'admin.submissions',
    slug: w.form.slug
  }).submissions;
  assert.deepEqual(
    [
      rows[0].data.leader_code,
      rows[0].data.email,
      rows[0].data.members.map((m) => m.code)
    ],
    ['4230003', 'mona@example.com', ['4230002']]
  );
  assert.deepEqual(
    rows[1].data.members.map((m) => m.code),
    ['4230001']
  );
});

test('Transfer: the phone of the other leader shows with a waiting request, with Copy, and as a WhatsApp link when the form says so', async () => {
  const w = bootTransfers();
  const setRules = (more) =>
    w.admin({
      action: 'admin.forms.update',
      id: w.form.id,
      patch: {
        rules: {
          ...w.admin({ action: 'admin.forms.get', id: w.form.id }).form.rules,
          ...more
        }
      }
    });
  setRules({ transferPhones: true });
  const p = await teamBWith(w, '4230002');
  p.submitForm();
  await settle(12);
  assert.equal(
    p.$('.overlay .leader-contact'),
    null,
    'no number before the team has asked'
  );
  p.clickText('Ask the leader', p.$('.overlay .dialog'));
  await settle(14);
  const sent = p.$('[name="transfer-sent"] .leader-contact');
  assert.ok(
    sent.textContent.includes(`Leader of team ${w.teamA.ref}:`) &&
      sent.textContent.includes('01012345678')
  );
  assert.equal(
    sent.querySelector('a'),
    null,
    'plain text while the WhatsApp switch is off'
  );
  assert.equal(
    sent.querySelector('[name="copy-phone"]').textContent,
    'Copy number'
  );
  let copied = '';
  Object.defineProperty(p.win.navigator, 'clipboard', {
    value: {
      writeText: async (text) => {
        copied = text;
      }
    },
    configurable: true
  });
  p.click('[name="copy-phone"]');
  await settle(4);
  assert.equal(copied, '01012345678');
  assert.ok(p.$('.toast').textContent.includes('Copied'));

  setRules({ transferWhatsapp: true });
  const refB = w.admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions[1].ref;
  const a = await openWithKey(w, w.teamA.key);
  const inDialog = a.$('.overlay .dialog .leader-contact');
  assert.ok(inDialog.textContent.includes(`Leader of team ${refB}:`));
  assert.equal(
    inDialog.querySelector('a').getAttribute('href'),
    'https://wa.me/201012345678'
  );
  assert.ok(
    inDialog.querySelector('[name="copy-phone"]'),
    'Copy stays next to the link'
  );
  a.click('[name="transfer-later"]');
  await settle(4);
  assert.ok(
    a.$('[data-transfer="incoming"] .leader-contact a'),
    'the line above the registration has it too'
  );
  a.click('[name="transfer-answer"]');
  await settle(4);
  a.click('[name="transfer-reject"]');
  await settle(12);
  assert.equal(
    a.$('.leader-contact'),
    null,
    'an answered request no longer shows the number'
  );
});

test('Transfer: a leader who is alone in a team is not offered, and the page says why', async () => {
  const w = bootTransfers();
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'c@example.com',
      leader_name: AR_NAME,
      leader_code: '4230050',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      title: 'Parser',
      team_size: '1',
      members: []
    }
  });
  const p = await teamBWith(w, '4230050');
  p.submitForm();
  await settle(12);
  assert.equal(p.$('.overlay'), null, 'there is nothing to ask for');
  assert.ok(
    p
      .text()
      .includes(
        'Someone in this team is already registered in another team. (4230050) سارة خالد حسن علي (4230050) cannot be asked for: they lead a team with no other member.'
      )
  );
});

test('Deadline: after a task form closes, the key shows the task but cannot change or cancel it', async () => {
  const w = boot('task_submission', {
    closesAt: '2027-09-02T10:00:00Z',
    rules: { driveCheck: 'off' }
  });
  const r = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@b.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      team_size: '1',
      members: [],
      title: 'Normalization',
      link: `https://drive.google.com/file/d/${ID('a')}/view`
    }
  });
  w.setNow('2027-09-03T10:00:00Z');
  const p = await open(w);
  p.clickText('Edit or cancel with your key');
  await settle();
  p.type('#key-input', r.key);
  p.submitForm();
  await settle(10);
  assert.ok(p.text().includes('The deadline has passed'));
  assert.ok(p.text().includes('Normalization'), 'the task is still shown');
  assert.equal(
    p.$$('button').some((b) => b.textContent.includes('Cancel registration')),
    false,
    'no cancel button'
  );
});

test('Edit by key: Close leaves the registration, and asks first when something was changed', async () => {
  const w = boot('team_registration');
  const r = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@b.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      team_size: '1',
      members: [],
      title: 'Library System'
    }
  });
  const p = await open(w);
  assert.equal(
    p.$('[name="phone"]').placeholder,
    '01xxxxxxxxx',
    'the hint shows the shape of a number, not a number'
  );
  const openIt = async () => {
    p.clickText('Edit or cancel with your key');
    await settle();
    p.type('#key-input', r.key);
    p.submitForm();
    await settle(8);
  };
  await openIt();
  assert.equal(p.$('[name="close-edit"]').textContent, 'Close');
  p.click('[name="close-edit"]');
  await settle(8);
  assert.equal(
    p.$('.trail .is-current .trail-label').textContent,
    'About you',
    'back to a new registration'
  );
  assert.equal(p.$('[name="leader_code"]').value, '');

  await openIt();
  p.click(p.$$('.review-group .link-btn')[3]);
  await settle();
  assert.equal(
    p.$('[name="close-edit"]'),
    null,
    'a page of the registration returns to the summary with Done'
  );
  p.type('[name="title"]', 'Library System v2');
  p.submitForm();
  await settle();
  assert.equal(p.$('[name="close-edit"]').textContent, 'Close without saving');
  p.click('[name="close-edit"]');
  await settle();
  assert.ok(p.text().includes('The changes you made are not saved.'));
  p.clickText('Keep editing');
  await settle();
  assert.equal(p.$('#step-title').textContent, 'Your registration');
  p.click('[name="close-edit"]');
  await settle();
  p.click('.overlay .btn-danger');
  await settle(8);
  assert.equal(p.$('.trail .is-current .trail-label').textContent, 'About you');
  assert.equal(
    w.sheet(w.form.sheetId, 'Responses').rows()[1][10],
    'Library System',
    'nothing was saved'
  );
});
