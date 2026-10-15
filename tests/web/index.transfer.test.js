const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const {
  boot,
  open,
  AR_NAME,
  fillAbout,
  fillStudy
} = require('../harness/form-page.js');

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

test(
  'Transfer: a member of another team can be asked for, and the team ' +
    'registers without them',
  async () => {
    const w = bootTransfers();
    const p = await teamBWith(w, '4230002');
    p.submitForm();
    await settle(12);
    const dialog = p.$('.overlay .dialog');
    assert.ok(dialog.textContent.includes('Already in another team'));
    assert.ok(
      dialog.textContent.includes(
        `سارة خالد حسن علي (4230002) → ${w.teamA.ref}`
      ),
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
  }
);

test(
  'Transfer: the leader who holds the member is asked when the ' +
    'registration opens, and approving moves the member',
  async () => {
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
    assert.ok(
      dialog.textContent.includes('A team asks for one of your members')
    );
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
  }
);

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

test(
  'Transfer: a leader who is asked for names the new leader, moves, ' +
    'and is told to pass the key on',
  async () => {
    const w = bootTransfers();
    const p = await teamBWith(w, '4230001');
    p.submitForm();
    await settle(12);
    const offer = p.$('.overlay .dialog');
    assert.ok(
      offer.textContent.includes(
        `(4230001) → ${w.teamA.ref} (leads that team)`
      ),
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
    assert.ok(
      a.$('.overlay'),
      'nothing is sent until the question is answered'
    );
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
  }
);

test(
  'Transfer: the phone of the other leader shows with a waiting ' +
    'request, with Copy, and as a WhatsApp link when the form says so',
  async () => {
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
  }
);

test(
  'Transfer: a leader who is alone in a team is not offered, and the ' +
    'page says why',
  async () => {
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
  }
);
