const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../harness/appsscript-mock.js');

function boot(rules = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const f = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Projects',
    term: 'Fall 2027',
    batchYear: '2027/2028'
  }).form;
  const base = w.admin({ action: 'admin.forms.get', id: f.id }).form.rules;
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: {
      status: 'open',
      rules: {
        ...base,
        transfers: true,
        transferEmails: true,
        teamSize: { min: 2, max: 3 },
        ...rules
      }
    }
  });
  w.slug = f.slug;
  return w;
}

const NAMES = {
  4230002: 'سارة خالد حسن علي',
  4230003: 'منى سعيد فؤاد علي',
  4230004: 'هدى سمير نبيل علي'
};
const member = (code) => ({
  name: NAMES[code] || 'ليلى أحمد محمود علي',
  phone: '01112345678',
  code: String(code),
  level: 'صفر / الأولى',
  curriculum: '2020',
  section: '4C-TH1'
});
const team = (leader, codes, extra = {}) => ({
  action: 'submit',
  slug: undefined,
  ...extra,
  data: {
    email: `l${leader}@b.com`,
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: String(leader),
    phone: '01012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    title: 'Library',
    team_size: String(codes.length + 1),
    members: codes.map(member)
  }
});
const send = (w, req) => w.api({ ...req, slug: w.slug });
const rows = (w) => w.admin({ action: 'admin.submissions', slug: w.slug });
const codesOf = (r) => r.data.members.map((m) => m.code);

/**
 * Team A (leader 4230001) holds 4230002 and 4230003; team B (leader 4230011)
 * asks for the leader of A.
 */
function leaderAsked(w) {
  const a = send(w, team(4230001, [4230002, 4230003]));
  const refused = send(w, team(4230011, [4230001]));
  const b = send(w, team(4230011, [4230001], { transfer: ['4230001'] }));
  return {
    a,
    b,
    refused,
    request: send(w, { action: 'lookup', key: a.key }).transfers.incoming[0]
  };
}

const { openPage, helpers, settle } = require('../harness/dom.js');

async function openAdmin(w, hash) {
  const dom = await openPage('admin.html', w, { hash });
  dom.window.App.api.setPin('4321');
  await dom.window.App.admin.start();
  await settle(10);
  return { dom, win: dom.window, ...helpers(dom.window) };
}

test(
  'Transfer dashboard: the rule is a switch under one team per ' +
    'student, and Responses lists what waits',
  async () => {
    const w = boot({ transfers: false, transferEmails: undefined });
    const set = await openAdmin(w, `#/f/${w.slug}/settings`);
    assert.equal(
      set.$('.sub-setting').hidden,
      false,
      'shown while a student may be in only one team'
    );
    const one = set.$('[name="uniqueAcrossForm"]');
    one.checked = false;
    set.fire(one, 'change');
    assert.ok(set.$('.sub-setting').hidden, 'and hidden with it');
    one.checked = true;
    set.fire(one, 'change');
    assert.ok(
      set.$('[name="transferEmails"]').closest('.sub-setting').hidden,
      'the email switch waits for the transfer switch'
    );
    const box = set.$('[name="transfers"]');
    box.checked = true;
    set.fire(box, 'change');
    const mail = set.$('[name="transferEmails"]');
    assert.equal(mail.closest('.sub-setting').hidden, false);
    assert.equal(mail.checked, false, 'transfer emails start switched off');
    const phones = set.$('[name="transferPhones"]'),
      whatsapp = set.$('[name="transferWhatsapp"]');
    assert.equal(
      phones.closest('.sub-setting'),
      mail.closest('.sub-setting'),
      'the phone switch sits with the other choices of a request'
    );
    assert.deepEqual(
      [phones.checked, whatsapp.closest('.sub-setting').hidden],
      [false, true],
      'the WhatsApp switch waits for the phone switch'
    );
    phones.checked = true;
    set.fire(phones, 'change');
    assert.equal(whatsapp.closest('.sub-setting').hidden, false);
    whatsapp.checked = true;
    set.fire(whatsapp, 'change');
    set.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: w.slug }).form.rules;
    assert.deepEqual(
      [
        saved.transfers,
        saved.transferEmails === true,
        saved.transferPhones,
        saved.transferWhatsapp
      ],
      [true, false, true, true]
    );
    w.admin({
      action: 'admin.forms.update',
      id: w.slug,
      patch: {
        rules: { ...saved, transferPhones: false, transferWhatsapp: false }
      }
    });

    const a = send(w, team(4230001, [4230002]));
    const b = send(
      w,
      team(4230011, [4230002, 4230004], { transfer: ['4230002'] })
    );
    const p = await openAdmin(w, `#/f/${w.slug}`);
    const row = p.$('.request-row');
    assert.ok(
      p
        .$('.requests')
        .textContent.includes('One student asked for by another team')
    );
    assert.ok(
      row.textContent.includes(NAMES[4230002]) &&
        row.textContent.includes(`from ${a.ref} to ${b.ref}`)
    );
    assert.equal(p.$('[name="under-min"]'), null);
    p.click('[name="transfer-approve"]');
    await settle(14);
    assert.equal(
      p.$('.request-row'),
      null,
      'an answered request leaves the list'
    );
    assert.ok(
      p
        .$('[name="under-min"]')
        .textContent.includes(`One team is under the minimum of 2: ${a.ref}.`)
    );
    assert.deepEqual(codesOf(rows(w).submissions[1]), ['4230004', '4230002']);
  }
);

test(
  'Transfer dashboard: moving a leader asks who leads the team next, ' +
    'and a leader alone can only be kept',
  async () => {
    const w = boot();
    const { a, b } = leaderAsked(w);
    const p = await openAdmin(w, `#/f/${w.slug}`);
    assert.ok(
      p
        .$('.request-row')
        .textContent.includes(`from ${a.ref}, which they lead, to ${b.ref}`)
    );
    p.click('[name="transfer-approve"]');
    await settle(6);
    const dialog = p.$('.overlay .dialog');
    assert.ok(dialog.textContent.includes(`Who leads ${a.ref} next?`));
    p.click('[name="confirm-yes"]');
    await settle(4);
    assert.deepEqual(
      p.$$('.handover .error').map((e) => e.textContent),
      ['Choose the new leader.', 'Write the email of the new leader.'],
      'the dialog stays open with the reasons'
    );
    assert.equal(rows(w).transfers.length, 1);
    p.pick('handover-leader', '4230003');
    p.type('[name="handover-email"]', 'new@b.com');
    p.click('[name="confirm-yes"]');
    await settle(14);
    assert.equal(p.$('.overlay'), null);
    assert.equal(
      p.$('.request-row'),
      null,
      'an answered request leaves the list'
    );
    const [teamA, teamB] = rows(w).submissions;
    assert.deepEqual(
      [teamA.data.leader_code, teamA.data.email, codesOf(teamA)],
      ['4230003', 'new@b.com', ['4230002']]
    );
    assert.deepEqual(codesOf(teamB), ['4230001']);

    const lone = boot();
    const asked = leaderAsked(lone);
    lone.admin({
      action: 'admin.forms.update',
      id: lone.slug,
      patch: {
        rules: {
          ...lone.admin({ action: 'admin.forms.get', id: lone.slug }).form
            .rules,
          teamSize: { min: 1, max: 3 }
        }
      }
    });
    send(lone, {
      action: 'update',
      key: asked.a.key,
      data: team(4230001, []).data
    });
    const q = await openAdmin(lone, `#/f/${lone.slug}`);
    assert.ok(
      q
        .$('.request-row')
        .textContent.includes(
          `from ${asked.a.ref}, which they lead alone, to ${asked.b.ref}. ` +
            `Nobody is left to lead ${asked.a.ref}, so they cannot move.`
        )
    );
    assert.equal(
      q.$('[name="transfer-approve"]'),
      null,
      'approving is offered only while somebody can lead'
    );
    assert.ok(q.$('[name="transfer-reject"]'));
  }
);
