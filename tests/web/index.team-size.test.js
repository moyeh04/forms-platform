const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, open, fillAbout, fillStudy } = require('../harness/form-page.js');

test(
  'Team size: member forms stay hidden until a size is chosen, and ' +
    'Next needs it',
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
  }
);

test(
  'Team size: choosing a size ' + 'shows exactly that many member forms',
  async () => {
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
  }
);

test(
  'Team members: remove takes that member out and lowers the size, ' +
    'Undo brings it back, add raises the size',
  async () => {
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
  }
);

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

test(
  'Team size: a fixed size ' + 'is selected for the student automatically',
  async () => {
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
  }
);

test(
  'Team size: a team of three ' + 'submits all its members and stores them',
  async () => {
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
  }
);

test(
  'Size note: picking a size with a note shows it under the chips and ' +
    'on the review',
  async () => {
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
  }
);
