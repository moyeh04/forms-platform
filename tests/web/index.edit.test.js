const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const {
  ID,
  boot,
  open,
  AR_NAME,
  fillAbout,
  fillStudy
} = require('../harness/form-page.js');

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
