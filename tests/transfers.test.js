const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

function boot(rules = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const f = w.admin({ action: 'admin.forms.create', type: 'team_registration', title: 'Projects', term: 'Fall 2027', batchYear: '2027/2028' }).form;
  const base = w.admin({ action: 'admin.forms.get', id: f.id }).form.rules;
  w.admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', rules: { ...base, transfers: true, transferEmails: true, teamSize: { min: 2, max: 3 }, ...rules } } });
  w.slug = f.slug;
  return w;
}

const NAMES = { 4230002: 'سارة خالد حسن علي', 4230003: 'منى سعيد فؤاد علي', 4230004: 'هدى سمير نبيل علي' };
const member = (code) => ({ name: NAMES[code] || 'ليلى أحمد محمود علي', phone: '01112345678', code: String(code), level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' });
const team = (leader, codes, extra = {}) => ({
  action: 'submit', slug: undefined, ...extra,
  data: { email: `l${leader}@b.com`, leader_name: 'أحمد محمد محمود أحمد', leader_code: String(leader), phone: '01012345678', major: 'حاسبات', level: 'صفر / الأولى', section: '4C-TH1', curriculum: '2020', title: 'Library', team_size: String(codes.length + 1), members: codes.map(member) }
});
const send = (w, req) => w.api({ ...req, slug: w.slug });
const rows = (w) => w.admin({ action: 'admin.submissions', slug: w.slug });
const codesOf = (r) => r.data.members.map((m) => m.code);

/** Team A (leader 4230001) holds 4230002 and 4230003; team B (leader 4230011) asks for 4230002. */
function asked(w) {
  const a = send(w, team(4230001, [4230002, 4230003]));
  const refused = send(w, team(4230011, [4230002, 4230004]));
  const b = send(w, team(4230011, [4230002, 4230004], { transfer: ['4230002'] }));
  return { a, b, refused };
}

test('Transfer: a member of another team is refused with what can be asked for, then saved as a request', () => {
  const w = boot();
  const { a, b, refused } = asked(w);
  assert.equal(refused.error.code, 'duplicate_member');
  assert.deepEqual(refused.error.details.codes, ['4230002']);
  assert.deepEqual(refused.error.details.transfer, [{ code: '4230002', team: a.ref }]);
  assert.equal(b.ok, true);
  assert.deepEqual(b.transfers, [{ code: '4230002', name: NAMES[4230002], team: a.ref }]);
  assert.deepEqual(b.data.members.map((m) => m.code), ['4230004'], 'the team is saved without the member');
  assert.equal(b.data.team_size, '2', 'and its size follows');
  const all = rows(w);
  assert.deepEqual(codesOf(all.submissions[0]), ['4230002', '4230003'], 'the other team is untouched until an answer');
  assert.deepEqual(all.transfers.map((t) => [t.code, t.name, t.from, t.to]), [['4230002', NAMES[4230002], a.ref, b.ref]]);
  const mail = w.mail.filter((m) => m.subject.includes('asks for one of your members'));
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, 'l4230001@b.com');
  assert.ok(mail[0].body.includes(`Team ${b.ref} asks for ${NAMES[4230002]} (4230002)`));
});

test('Transfer: the leader of the other team sees the request with the key and approving moves the member', () => {
  const w = boot();
  const { a, b } = asked(w);
  const seen = send(w, { action: 'lookup', key: a.key });
  assert.deepEqual(seen.transfers.incoming, [{ id: seen.transfers.incoming[0].id, code: '4230002', name: NAMES[4230002], team: b.ref, sizeAfter: 2, min: 2 }]);
  assert.deepEqual(send(w, { action: 'lookup', key: b.key }).transfers.outgoing.map((t) => [t.code, t.status, t.team]), [['4230002', 'pending', a.ref]]);
  const wrong = send(w, { action: 'transfer.decide', key: b.key, id: seen.transfers.incoming[0].id, approve: true });
  assert.equal(wrong.error.code, 'transfer_gone', 'the team that asked cannot approve its own request');

  const done = send(w, { action: 'transfer.decide', key: a.key, id: seen.transfers.incoming[0].id, approve: true });
  assert.equal(done.ok, true);
  assert.deepEqual(done.submission.data.members.map((m) => m.code), ['4230003']);
  assert.equal(done.submission.data.team_size, '2');
  assert.deepEqual(done.transfers.incoming, []);
  const all = rows(w);
  assert.deepEqual(codesOf(all.submissions[1]), ['4230004', '4230002']);
  assert.equal(all.submissions[1].data.team_size, '3');
  assert.ok(all.submissions[1].members.includes('4230002'), 'the readable members column follows');
  assert.deepEqual(all.transfers, []);
  assert.deepEqual(send(w, { action: 'lookup', key: b.key }).transfers.outgoing.map((t) => t.status), ['approved']);
  assert.ok(w.mail.some((m) => m.to === 'l4230011@b.com' && m.subject.includes('Your request was approved')));
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id: seen.transfers.incoming[0].id, approve: true }).error.code, 'transfer_gone', 'a request is answered once');
});

test('Transfer: rejecting keeps both teams, and the team that asked can cancel while it waits', () => {
  const w = boot();
  const { a, b } = asked(w);
  const id = send(w, { action: 'lookup', key: a.key }).transfers.incoming[0].id;
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id, approve: false }).ok, true);
  let all = rows(w);
  assert.deepEqual([codesOf(all.submissions[0]), codesOf(all.submissions[1])], [['4230002', '4230003'], ['4230004']]);
  assert.deepEqual(send(w, { action: 'lookup', key: b.key }).transfers.outgoing.map((t) => t.status), ['rejected']);
  assert.ok(w.mail.some((m) => m.to === 'l4230011@b.com' && m.subject.includes('Your request was rejected')));

  const again = send(w, { action: 'update', key: b.key, data: team(4230011, [4230004, 4230003]).data, transfer: ['4230003'] });
  assert.equal(again.ok, true, 'an edit can ask as well');
  const mine = send(w, { action: 'lookup', key: b.key }).transfers.outgoing.filter((t) => t.status === 'pending');
  assert.equal(mine.length, 1);
  assert.equal(send(w, { action: 'transfer.cancel', key: a.key, id: mine[0].id }).error.code, 'transfer_gone', 'only the team that asked cancels');
  assert.equal(send(w, { action: 'transfer.cancel', key: b.key, id: mine[0].id }).ok, true);
  assert.deepEqual(rows(w).transfers, []);
  assert.deepEqual(send(w, { action: 'lookup', key: a.key }).transfers.incoming, []);
});

test('Transfer: a team deleted by the admin takes its requests with it', () => {
  const w = boot();
  const { a, b } = asked(w);
  assert.equal(rows(w).transfers.length, 1);
  const asking = rows(w).submissions.filter((s) => s.ref === b.ref)[0];
  assert.equal(w.admin({ action: 'admin.submission.delete', slug: w.slug, submissionId: asking.id }).deleted, true);
  assert.deepEqual(rows(w).transfers, []);
  assert.deepEqual(send(w, { action: 'lookup', key: a.key }).transfers.incoming, []);
});

test('Transfer: the admin answers from the dashboard, and a team left under the minimum is reported', () => {
  const w = boot();
  const a = send(w, team(4230001, [4230002]));
  const b = send(w, team(4230011, [4230002, 4230004], { transfer: ['4230002'] }));
  assert.equal(b.ok, true);
  const waiting = rows(w).transfers;
  const out = w.admin({ action: 'admin.transfer.decide', slug: w.slug, transfer: waiting[0].id, approve: true });
  assert.equal(out.underMin, true, 'team A is alone now, under the minimum of 2');
  assert.deepEqual(out.transfers, []);
  const all = rows(w);
  assert.deepEqual([codesOf(all.submissions[0]), all.submissions[0].data.team_size], [[], '1']);
  assert.deepEqual(codesOf(all.submissions[1]), ['4230004', '4230002']);
  assert.equal(a.ok, true);
});

test('Transfer: a full team cannot receive, and a second request for the same student closes', () => {
  const w = boot();
  const a = send(w, team(4230001, [4230002, 4230003]));
  const b = send(w, team(4230011, [4230002, 4230004], { transfer: ['4230002'] }));
  const c = send(w, team(4230021, [4230002, 4230005], { transfer: ['4230002'] }));
  assert.equal(rows(w).transfers.length, 2);
  // Team B fills up before the answer.
  assert.equal(send(w, { action: 'update', key: b.key, data: team(4230011, [4230004, 4230006]).data }).ok, true);
  const incoming = send(w, { action: 'lookup', key: a.key }).transfers.incoming;
  const toB = incoming.find((t) => t.team === b.ref), toC = incoming.find((t) => t.team === c.ref);
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id: toB.id, approve: true }).error.code, 'transfer_full');
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id: toC.id, approve: true }).ok, true);
  assert.deepEqual(rows(w).transfers, [], 'the other request for the same student is closed');
  assert.deepEqual(send(w, { action: 'lookup', key: b.key }).transfers.outgoing.map((t) => t.status), ['closed']);
});

/** Team A (leader 4230001) holds 4230002 and 4230003; team B (leader 4230011) asks for the leader of A. */
function leaderAsked(w) {
  const a = send(w, team(4230001, [4230002, 4230003]));
  const refused = send(w, team(4230011, [4230001]));
  const b = send(w, team(4230011, [4230001], { transfer: ['4230001'] }));
  return { a, b, refused, request: send(w, { action: 'lookup', key: a.key }).transfers.incoming[0] };
}

test('Transfer: a leader can be asked for, and approving hands the team to the member the leader names', () => {
  const w = boot();
  const { a, b, refused, request } = leaderAsked(w);
  assert.deepEqual(refused.error.details.transfer, [{ code: '4230001', team: a.ref, leader: true }], 'the offer says the student leads that team');
  assert.equal(b.ok, true);
  assert.deepEqual([request.leader, request.sizeAfter], [true, 2]);
  assert.deepEqual(request.heirs, [{ code: '4230002', name: NAMES[4230002] }, { code: '4230003', name: NAMES[4230003] }]);

  const decide = (handover) => send(w, { action: 'transfer.decide', key: a.key, id: request.id, approve: true, handover });
  assert.equal(decide().error.code, 'transfer_heir', 'a team is never left without a leader');
  assert.equal(decide({ leader: '4230004', email: 'new@b.com' }).error.code, 'transfer_heir', 'the new leader is a member of the team');
  const noMail = decide({ leader: '4230002', email: 'nobody' });
  assert.deepEqual([noMail.error.code, noMail.error.details.error], ['transfer_email', 'invalid_email']);
  assert.equal(rows(w).submissions[0].data.leader_code, '4230001', 'a refused answer changes nothing');

  const done = decide({ leader: '4230002', email: 'new@b.com' });
  assert.equal(done.ok, true);
  const [teamA, teamB] = rows(w).submissions;
  assert.deepEqual([teamA.data.leader_code, teamA.data.leader_name, teamA.data.email, teamA.data.phone], ['4230002', NAMES[4230002], 'new@b.com', '01112345678']);
  assert.equal(teamA.data.major, 'حاسبات', 'what only the leader answered stays with the team');
  assert.deepEqual([codesOf(teamA), teamA.data.team_size], [['4230003'], '2']);
  assert.deepEqual([codesOf(teamB), teamB.data.team_size, teamB.data.leader_code], [['4230001'], '2', '4230011']);
  assert.equal(teamA.ref, a.ref, 'the team keeps its reference');
  assert.equal(send(w, { action: 'lookup', key: a.key }).submission.ref, a.ref, 'and its key');

  const told = w.mail.filter((m) => /You now lead your team/.test(m.subject));
  assert.deepEqual(told.map((m) => m.to), ['new@b.com']);
  assert.ok(told[0].body.includes(`You now lead team ${a.ref}.`));
  assert.equal(told[0].body.includes(a.key), false, 'the key itself is passed on by the leader who left, not by email');
});

test('Transfer: a leader who is alone in a team cannot be asked for, and one left alone cannot be moved', () => {
  const w = boot({ teamSize: { min: 1, max: 3 } });
  const alone = send(w, team(4230001, []));
  const refused = send(w, team(4230011, [4230001], { transfer: ['4230001'] }));
  assert.equal(refused.error.code, 'duplicate_member');
  assert.deepEqual(refused.error.details.transfer, [], 'nobody would be left to lead that team');
  send(w, { action: 'remove', key: alone.key });

  const { a, request } = leaderAsked(w);
  assert.equal(send(w, { action: 'update', key: a.key, data: team(4230001, []).data }).ok, true);
  const now = send(w, { action: 'lookup', key: a.key }).transfers.incoming[0];
  assert.deepEqual([now.leader, now.heirs], [true, []]);
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id: request.id, approve: true, handover: { leader: '4230002', email: 'new@b.com' } }).error.code, 'transfer_leader');
  assert.equal(send(w, { action: 'transfer.decide', key: a.key, id: request.id, approve: false }).ok, true);
});

test('Transfer: the admin moves a leader with the same question, and sees who can lead next', () => {
  const w = boot();
  const { a, b } = leaderAsked(w);
  const [waiting] = rows(w).transfers;
  assert.deepEqual([waiting.leader, waiting.heirs.map((m) => m.code), waiting.from, waiting.to], [true, ['4230002', '4230003'], a.ref, b.ref]);
  assert.equal(w.admin({ action: 'admin.transfer.decide', slug: w.slug, transfer: waiting.id, approve: true }).error.code, 'transfer_heir');
  const out = w.admin({ action: 'admin.transfer.decide', slug: w.slug, transfer: waiting.id, approve: true, handover: { leader: '4230003', email: 'new@b.com' } });
  assert.deepEqual([out.ok, out.transfers, out.underMin], [true, [], false]);
  const [teamA] = rows(w).submissions;
  assert.deepEqual([teamA.data.leader_code, codesOf(teamA)], ['4230003', ['4230002']]);
});

test('Transfer: with the switch on, the two leaders of a waiting request see each other\'s phone', () => {
  const phoned = (req, phone) => ({ ...req, data: { ...req.data, phone } });
  const w = boot({ transferPhones: true });
  const a = send(w, phoned(team(4230001, [4230002, 4230003]), '01011111111'));
  const refused = send(w, phoned(team(4230011, [4230002, 4230004]), '01022222222'));
  assert.deepEqual(refused.error.details.transfer, [{ code: '4230002', team: a.ref }], 'no number before the team has asked');
  const b = send(w, phoned(team(4230011, [4230002, 4230004], { transfer: ['4230002'] }), '01022222222'));
  assert.deepEqual(b.transfers, [{ code: '4230002', name: NAMES[4230002], team: a.ref, phone: '01011111111' }]);
  const seen = (key) => send(w, { action: 'lookup', key }).transfers;
  assert.deepEqual([seen(a.key).incoming[0].phone, seen(a.key).incoming[0].whatsapp], ['01022222222', undefined]);
  assert.equal(seen(b.key).outgoing[0].phone, '01011111111');

  const rules = w.admin({ action: 'admin.forms.get', id: w.slug }).form.rules;
  w.admin({ action: 'admin.forms.update', id: w.slug, patch: { rules: { ...rules, transferWhatsapp: true } } });
  assert.deepEqual([seen(a.key).incoming[0].whatsapp, seen(b.key).outgoing[0].whatsapp], [true, true]);

  send(w, { action: 'transfer.decide', key: a.key, id: seen(a.key).incoming[0].id, approve: false });
  assert.deepEqual(seen(b.key).outgoing.map((t) => [t.status, t.phone]), [['rejected', undefined]], 'an answered request no longer shows the number');

  const off = boot({ transferWhatsapp: true });
  const { a: a2, b: b2 } = asked(off);
  assert.equal(b2.transfers[0].phone, undefined, 'the WhatsApp switch alone shows nothing');
  assert.equal(send(off, { action: 'lookup', key: a2.key }).transfers.incoming[0].phone, undefined);
});

test('Transfer: off by default, and a cancelled team takes its requests with it', () => {
  const off = boot({ transfers: false });
  send(off, team(4230001, [4230002, 4230003]));
  const refused = send(off, team(4230011, [4230002, 4230004], { transfer: ['4230002'] }));
  assert.equal(refused.error.code, 'duplicate_member');
  assert.equal(refused.error.details.transfer, undefined, 'nothing is offered while the rule is off');
  assert.deepEqual(send(off, { action: 'lookup', key: send(off, team(4230021, [4230022])).key }).transfers, { incoming: [], outgoing: [] });

  const w = boot();
  const { a, b } = asked(w);
  assert.equal(send(w, { action: 'remove', key: b.key }).ok, true);
  assert.deepEqual(rows(w).transfers, []);
  assert.deepEqual(send(w, { action: 'lookup', key: a.key }).transfers.incoming, []);
});

const { openPage, helpers, settle } = require('./harness/dom.js');

async function openAdmin(w, hash) {
  const dom = await openPage('admin.html', w, { hash });
  dom.window.App.api.setPin('4321');
  await dom.window.App.admin.start();
  await settle(10);
  return { dom, win: dom.window, ...helpers(dom.window) };
}

test('Transfer dashboard: the rule is a switch under one team per student, and Responses lists what waits', async () => {
  const w = boot({ transfers: false, transferEmails: undefined });
  const set = await openAdmin(w, `#/f/${w.slug}/settings`);
  assert.equal(set.$('.sub-setting').hidden, false, 'shown while a student may be in only one team');
  const one = set.$('[name="uniqueAcrossForm"]'); one.checked = false; set.fire(one, 'change');
  assert.ok(set.$('.sub-setting').hidden, 'and hidden with it');
  one.checked = true; set.fire(one, 'change');
  assert.ok(set.$('[name="transferEmails"]').closest('.sub-setting').hidden, 'the email switch waits for the transfer switch');
  const box = set.$('[name="transfers"]'); box.checked = true; set.fire(box, 'change');
  const mail = set.$('[name="transferEmails"]');
  assert.equal(mail.closest('.sub-setting').hidden, false);
  assert.equal(mail.checked, false, 'transfer emails start switched off');
  set.click('[name="save"]'); await settle(12);
  const saved = w.admin({ action: 'admin.forms.get', id: w.slug }).form.rules;
  assert.deepEqual([saved.transfers, saved.transferEmails === true], [true, false]);

  const a = send(w, team(4230001, [4230002]));
  const b = send(w, team(4230011, [4230002, 4230004], { transfer: ['4230002'] }));
  const p = await openAdmin(w, `#/f/${w.slug}`);
  const row = p.$('.request-row');
  assert.ok(p.$('.requests').textContent.includes('One student asked for by another team'));
  assert.ok(row.textContent.includes(NAMES[4230002]) && row.textContent.includes(`from ${a.ref} to ${b.ref}`));
  assert.equal(p.$('[name="under-min"]'), null);
  p.click('[name="transfer-approve"]'); await settle(14);
  assert.equal(p.$('.request-row'), null, 'an answered request leaves the list');
  assert.ok(p.$('[name="under-min"]').textContent.includes(`One team is under the minimum of 2: ${a.ref}.`));
  assert.deepEqual(codesOf(rows(w).submissions[1]), ['4230004', '4230002']);
});

test('Transfer dashboard: moving a leader asks who leads the team next, and a leader alone can only be kept', async () => {
  const w = boot();
  const { a, b } = leaderAsked(w);
  const p = await openAdmin(w, `#/f/${w.slug}`);
  assert.ok(p.$('.request-row').textContent.includes(`from ${a.ref}, which they lead, to ${b.ref}`));
  p.click('[name="transfer-approve"]'); await settle(6);
  const dialog = p.$('.overlay .dialog');
  assert.ok(dialog.textContent.includes(`Who leads ${a.ref} next?`));
  p.click('[name="confirm-yes"]'); await settle(4);
  assert.deepEqual(p.$$('.handover .error').map((e) => e.textContent), ['Choose the new leader.', 'Write the email of the new leader.'], 'the dialog stays open with the reasons');
  assert.equal(rows(w).transfers.length, 1);
  p.pick('handover-leader', '4230003');
  p.type('[name="handover-email"]', 'new@b.com');
  p.click('[name="confirm-yes"]'); await settle(14);
  assert.equal(p.$('.overlay'), null);
  assert.equal(p.$('.request-row'), null, 'an answered request leaves the list');
  const [teamA, teamB] = rows(w).submissions;
  assert.deepEqual([teamA.data.leader_code, teamA.data.email, codesOf(teamA)], ['4230003', 'new@b.com', ['4230002']]);
  assert.deepEqual(codesOf(teamB), ['4230001']);

  const lone = boot();
  const asked = leaderAsked(lone);
  lone.admin({ action: 'admin.forms.update', id: lone.slug, patch: { rules: { ...lone.admin({ action: 'admin.forms.get', id: lone.slug }).form.rules, teamSize: { min: 1, max: 3 } } } });
  send(lone, { action: 'update', key: asked.a.key, data: team(4230001, []).data });
  const q = await openAdmin(lone, `#/f/${lone.slug}`);
  assert.ok(q.$('.request-row').textContent.includes(`from ${asked.a.ref}, which they lead alone, to ${asked.b.ref}. Nobody is left to lead ${asked.a.ref}, so they cannot move.`));
  assert.equal(q.$('[name="transfer-approve"]'), null, 'approving is offered only while somebody can lead');
  assert.ok(q.$('[name="transfer-reject"]'));
});

test('Transfer: no email unless the form switches transfer emails on', () => {
  const w = boot({ transferEmails: undefined });
  const before = w.mail.length;
  const { a } = asked(w);
  const id = send(w, { action: 'lookup', key: a.key }).transfers.incoming[0].id;
  send(w, { action: 'transfer.decide', key: a.key, id, approve: true });
  assert.equal(w.mail.filter((m) => /asks for one of your members|Your request was/.test(m.subject)).length, 0);
  assert.ok(w.mail.length >= before, 'registration confirmations are a separate setting');
});
