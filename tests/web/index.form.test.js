const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('../harness/dom.js');
const {
  boot,
  open,
  AR_NAME,
  fillAbout,
  fillStudy
} = require('../harness/form-page.js');

test(
  'Form: shows the title, the term tag, a type icon, and one dot per ' +
    'step plus review',
  async () => {
    const w = boot();
    const p = await open(w);
    assert.equal(
      p.$('h1').textContent,
      'Database Team Project Registration Form'
    );
    assert.equal(p.$('.tag').textContent, 'Fall 2027');
    assert.ok(p.$('.form-icon svg'));
    assert.equal(p.$$('.trail li').length, 6);
    assert.equal(
      p.$('.trail .is-current .trail-label').textContent,
      'About you'
    );
    assert.equal(p.text().includes('Clean Code'), false);
    assert.equal(
      p.$('.sheet').querySelector('svg circle[r="9"]'),
      null,
      'no logo or seal'
    );
  }
);

test(
  'Form: Arabic name field strips English letters and digits as you ' +
    'type and says why',
  async () => {
    const w = boot();
    const p = await open(w);
    const input = p.$('[name="leader_name"]');
    assert.equal(input.getAttribute('lang'), 'ar');
    assert.equal(input.getAttribute('dir'), 'rtl');
    p.type(input, 'Ahmed أحمد 123 محمد');
    assert.equal(input.value, 'أحمد محمد');
    assert.ok(p.$('.hint').textContent.includes('Arabic'));
  }
);

test(
  'Form: the code field keeps ' + 'digits only and converts Arabic digits',
  async () => {
    const w = boot();
    const p = await open(w);
    const input = p.$('[name="leader_code"]');
    p.type(input, '٤٢٣a0999999');
    assert.equal(input.value, '4230999');
  }
);

test(
  'Form: Next on an empty step ' + 'shows clear errors and stays put',
  async () => {
    const w = boot();
    const p = await open(w);
    p.submitForm();
    await settle();
    assert.equal(
      p.$('.trail .is-current .trail-label').textContent,
      'About you'
    );
    assert.ok(p.$$('.field.has-error').length >= 4);
    assert.ok(p.$('.banner').textContent.includes('Fix the highlighted'));
    assert.ok(
      p.text().includes('Enter a valid email address') === false,
      'empty email says required'
    );
    assert.ok(p.text().includes('This field is required.'));
  }
);

test(
  'Form: an English name is refused ' + 'with a specific message on blur',
  async () => {
    const w = boot();
    const p = await open(w);
    p.type('[name="leader_name"]', 'أحمد محمد');
    assert.ok(
      p
        .$('[data-path="leader_name"] .error')
        .textContent.includes('at least 4 names')
    );
  }
);

test(
  'Form: full registration with a team member ends on a ticket with a ' + 'key',
  async () => {
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
  }
);

test('Form: a draft survives a reload of the page', async () => {
  const w = boot();
  const p = await open(w);
  p.type('[name="email"]', 'draft@example.com');
  p.type('[name="leader_name"]', AR_NAME);
  const stored = p.win.sessionStorage.getItem(`fp_draft_${w.form.slug}`);
  assert.ok(stored.includes('draft@example.com'));
});

test(
  'Form: a duplicate code explains ' + 'itself and offers the key flow',
  async () => {
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
  }
);

test('Closed form shows the message and no questions', async () => {
  const w = boot('team_registration', { status: 'closed' });
  const p = await open(w);
  assert.ok(p.text().includes('This form is closed.'));
  assert.equal(p.$('input[name="email"]'), null);
});

test(
  'Language: switching to Arabic flips ' + 'direction and uses Arabic labels',
  async () => {
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
  }
);

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

test(
  'Theme: the toggle switches between ' + 'light and dark and remembers it',
  async () => {
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
  }
);

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

test(
  'Descriptions: a question description is shown between the label and ' +
    'the answer',
  async () => {
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
  }
);

test(
  'Subject: the subject code is shown ' + 'as a tag next to the term',
  async () => {
    const w = boot('team_registration', { subject: 'CMPn323' });
    const p = await open(w);
    assert.deepEqual(
      p.$$('.form-head .tag').map((t) => t.textContent),
      ['CMPn323', 'Fall 2027']
    );
  }
);

test(
  'WhatsApp: the public form shows only the batch year in its title ' +
    'and metadata',
  async () => {
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
  }
);

test(
  'Specialization: a Communications-only form says so and fills in the ' +
    'major',
  async () => {
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
  }
);

test(
  'Ticket: "a copy was sent" only ' + 'appears when an email really went out',
  async () => {
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
  }
);

test(
  'Folder rule: typing the project title updates the example and keeps ' +
    'the icon',
  async () => {
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
        .textContent.includes(
          'Ahmed_Mohamed_Smart_Parking_Software_Engineering'
        ),
      'ends with the subject name, not the code'
    );
  }
);

test(
  'Route: a sea of islands, and the ship sails from island to island ' +
    'toward the treasure',
  async () => {
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
  }
);
