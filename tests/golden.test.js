/**
 * Golden tests: they pin what the live system already depends on, so that
 * moving and splitting the backend cannot change it unseen. They pin the names
 * Apps Script calls, the salted hashes, the error code of every action, the
 * stored cells of legacy rows, and every sheet, property and cache entry after
 * one scripted run.
 *
 * The fixtures were written from the code as it is. `GOLDEN_UPDATE=1 npm test`
 * writes them again; do that only for a change that is meant to alter them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createWorld } = require('./harness/appsscript-mock.js');
const { bundleSource } = require('../scripts/build/bundle-backend.js');

const FIXTURES = path.join(__dirname, 'fixtures', 'golden');
const PIN = '4321';
const SEED = 20271015;

/** Compares `actual` with a stored fixture, or writes it when asked to. */
function matchesFixture(name, actual) {
  const file = path.join(FIXTURES, name);
  const text = JSON.stringify(actual, null, 1) + '\n';
  if (process.env.GOLDEN_UPDATE) {
    fs.mkdirSync(FIXTURES, { recursive: true });
    fs.writeFileSync(file, text);
  }
  assert.equal(
    text,
    fs.readFileSync(file, 'utf8'),
    `${name} differs from the stored fixture`
  );
}

/** A world with the registry set up, a PIN, and an admin caller. */
function boot() {
  const w = createWorld({ seed: SEED });
  w.call('setup');
  w.call('setAdminPin', PIN);
  w.admin = (b) => w.api({ ...b, admin: { pin: PIN } });
  return w;
}

/** Fails the test when a call that should work returns an error. */
function ok(reply) {
  assert.ok(!reply.error, JSON.stringify(reply.error));
  return reply;
}

test('Golden: every function Apps Script calls by name exists in the bundle', () => {
  const w = createWorld();
  const names = [
    'doGet',
    'doPost',
    'onOpen',
    'setup',
    'setAdminPin',
    'unlockAdmin',
    'menuSetup',
    'menuSetPin',
    'menuSetSiteUrl',
    'menuUnlockAdmin',
    'menuPrintReservations',
    'menuPrintTeamList',
    'menuRebuildViews',
    'menuPrint',
    'menuPrintOptions',
    'processDirtyViews'
  ];
  for (const name of names) {
    assert.equal(typeof w.ctx[name], 'function', name);
  }
  const menu = bundleSource().code;
  const named = [...menu.matchAll(/addItem\('[^']*', '(\w+)'\)/g)].map(
    (m) => m[1]
  );
  assert.ok(named.length > 0);
  for (const name of named)
    assert.ok(names.includes(name), `menu item ${name} is pinned`);
});

test('Golden: the salted hashes and seals are the same for the same pepper', () => {
  const w = createWorld();
  w.props.set('PEPPER', 'pepper-for-golden-tests');
  const form = { id: 'form-1' };
  const client = { id: 'client-1' };
  const hashes = {
    pin: w.call('AuthService.pinHash', '1234'),
    clientToken: w.call('ClientsService.clientToken', 'token-1'),
    clientKey: w.call('ClientsService.clientKeyHash', client, '12345'),
    clientPad: w.call('ClientsService.clientKeyPad', client),
    key: w.call('KeysService.keyHash', form, '12345'),
    keyPad: w.call('KeysService.keyPad', form, 'response-1'),
    seal: w.call('KeysService.sealKey', form, 'response-1', '12345'),
    unseal: w.call(
      'KeysService.unsealKey',
      form,
      'response-1',
      w.call('KeysService.sealKey', form, 'response-1', '12345')
    )
  };
  matchesFixture('hashes.json', hashes);
});

test('Golden: every action answers an empty, wrong-PIN, wrong-key, bare admin and real-form request the same way', () => {
  const w = boot();
  const form = openForm(w, 'team_registration', 'Team Form 1');
  const actions = Object.keys(w.ctx.API).sort();
  const codeOf = (reply) => (reply.error ? reply.error.code : 'ok');
  const table = {};
  for (const action of actions) {
    w.cache.clear();
    table[action] = [
      codeOf(w.api({ action })),
      codeOf(w.api({ action, admin: { pin: '0000' } })),
      codeOf(
        w.api({ action, token: 'wrong-token', key: '00000', slug: 'nothing' })
      ),
      codeOf(w.admin({ action })),
      codeOf(w.api({ action, slug: form.slug, key: '00000', id: 'nothing' }))
    ];
  }
  table['(unknown)'] = [codeOf(w.api({ action: 'nope' }))];
  table['(no action)'] = [codeOf(w.api({}))];
  matchesFixture('actions.json', table);
});

test('Golden: legacy flag cells read the same and are written back the same', () => {
  const w = boot();
  const sheet = w.sheet(w.props.get('REGISTRY_ID'), 'Clients');
  const header = sheet.rows()[0];
  const row = (values) => header.map((h) => (h in values ? values[h] : ''));
  sheet.appendRow(
    row({
      id: 'c1',
      name: 'Client 1',
      canReview: 1,
      active: 0,
      showSizeAlerts: 'TRUE'
    })
  );
  sheet.appendRow(
    row({
      id: 'c2',
      name: 'Client 2',
      canReview: '0',
      active: '',
      showSizeAlerts: '0'
    })
  );
  sheet.appendRow(
    row({
      id: 'c3',
      name: 'Client 3',
      canReview: 'TRUE',
      active: '1',
      showSizeAlerts: ''
    })
  );
  const read = w
    .call('ClientsRepository.readClients')
    .map((c) => [c.id, c.canReview, c.active, c.showSizeAlerts]);
  w.call('ClientsRepository.readClients').forEach((c) => w.call('ClientsRepository.saveClient', c));
  matchesFixture('legacy-cells.json', { read, written: sheet.rows() });
});

const ARABIC = [
  'طالب أول اسم تجريبي',
  'طالب ثاني اسم تجريبي',
  'طالب ثالث اسم تجريبي',
  'طالب رابع اسم تجريبي',
  'طالب خامس اسم تجريبي'
];
const study = { level: 'صفر / الأولى', curriculum: '2020', section: '4C-TH1' };
const member = (code, i) => ({
  name: ARABIC[i],
  phone: '01112345678',
  code,
  ...study
});
const team = (code, members, extra = {}) => ({
  email: `student${code}@example.com`,
  leader_name: ARABIC[0],
  leader_code: code,
  phone: '01012345678',
  major: 'حاسبات',
  title: 'Project ' + code,
  team_size: String(members.length + 1),
  members,
  ...study,
  ...extra
});

/** Creates a form, opens it with `patch`, and returns it. */
function openForm(w, type, title, patch = {}) {
  const form = ok(
    w.admin({ action: 'admin.forms.create', type, title, term: 'Fall 2027' })
  ).form;
  const rules = ok(w.admin({ action: 'admin.forms.get', id: form.id })).form
    .rules;
  ok(
    w.admin({
      action: 'admin.forms.update',
      id: form.id,
      patch: {
        status: 'open',
        ...patch,
        rules: { ...rules, ...(patch.rules || {}) }
      }
    })
  );
  return form;
}

/** One run through every kind of form and most actions, so every sheet and tab exists. */
function scenario(w) {
  ok(w.admin({ action: 'admin.lists.create', name: 'Labs', kind: 'plain' }));
  const teams = openForm(w, 'team_registration', 'Team Form 1', {
    rules: {
      transfers: true,
      transferEmails: true,
      teamSize: { min: 2, max: 3 }
    }
  });
  const send = (data, extra = {}) =>
    ok(w.api({ action: 'submit', slug: teams.slug, data, ...extra }));
  const a = send(team('4230001', [member('4230002', 1), member('4230003', 2)]));
  const b = send(
    team('4230011', [member('4230002', 1), member('4230004', 3)]),
    { transfer: ['4230002'] }
  );
  const incoming = ok(w.api({ action: 'lookup', slug: teams.slug, key: a.key }))
    .transfers.incoming[0];
  ok(
    w.api({
      action: 'transfer.decide',
      slug: teams.slug,
      key: a.key,
      id: incoming.id,
      approve: true
    })
  );
  const c = send(team('4230021', [member('4230022', 4)]));
  ok(w.api({ action: 'remove', slug: teams.slug, key: c.key }));
  const list = ok(
    w.admin({ action: 'admin.submissions', slug: teams.slug })
  ).submissions;
  ok(
    w.admin({
      action: 'admin.submission.update',
      slug: teams.slug,
      submissionId: list[0].id,
      patch: { status: 'in_review' }
    })
  );

  const tasks = openForm(w, 'task_submission', 'Task Form 1');
  const file = 'k'.repeat(33);
  w.drive.addFile({
    id: file,
    name: 'Task 1',
    mime: 'application/vnd.google-apps.presentation'
  });
  ok(
    w.api({
      action: 'submit',
      slug: tasks.slug,
      data: team('4230031', [member('4230032', 1)], {
        title: 'Task 1',
        link: `https://docs.google.com/presentation/d/${file}/edit`
      })
    })
  );

  const times = ['12:30 - 12:50', '12:55 - 1:15'];
  const booking = openForm(w, 'reservation', 'Booking Form 1', {
    slots: {
      days: [{ label: 'Day 1', date: '2027-11-14', times }],
      capacity: 1
    },
    keyBooking: { enabled: true, source: teams.id }
  });
  const day = ok(w.admin({ action: 'admin.forms.get', id: booking.id })).form
    .slots.days[0];
  ok(
    w.api({
      action: 'submit',
      slug: booking.slug,
      sourceKey: b.key,
      data: { slot: { day: day.id, time: times[0] } }
    })
  );

  const groups = openForm(w, 'whatsapp_registration', 'Group Form 1');
  ok(
    w.api({
      action: 'submit',
      slug: groups.slug,
      data: {
        email: 'student@example.com',
        name: ARABIC[0],
        phone: '01033344455',
        code: '4230041',
        level: study.level,
        major: 'حاسبات',
        group: 'A',
        section: '21',
        schedule: `https://drive.google.com/file/d/${'t'.repeat(33)}/view`
      }
    })
  );
  ok(
    w.admin({
      action: 'admin.matching.import',
      slug: groups.slug,
      text: 'Student 1 01033344455\n01199988877'
    })
  );

  const client = ok(
    w.admin({
      action: 'admin.clients.create',
      name: 'Client 1',
      forms: [teams.slug],
      hiddenColumns: [],
      canReview: true
    })
  );
  ok(
    w.admin({
      action: 'admin.clients.update',
      id: client.client.id,
      patch: { showSizeAlerts: false }
    })
  );
  w.api({ action: 'admin.login', admin: { pin: '0000' } });
  w.api({ action: 'lookup', slug: teams.slug, key: '00000' });
  w.runTriggers();
}

/** Everything the run left behind: sheets, properties, cache, mail and triggers. */
function stored(w) {
  const sheets = [...w.spreadsheets.values()].map((ss) => ({
    name: ss.name,
    tabs: ss.sheets.map((s) => ({ name: s.name, rows: s.rows() }))
  }));
  return {
    sheets,
    properties: Object.fromEntries([...w.props.entries()].sort()),
    cache: Object.fromEntries(
      [...w.cache.entries()].map(([k, e]) => [k, e.v]).sort()
    ),
    mail: w.mail.map((m) => ({ to: m.to, subject: m.subject })),
    triggers: w.triggers.map((t) => t.fn)
  };
}

test('Golden: one scripted run leaves the same sheets, properties, cache and mail', () => {
  const w = boot();
  scenario(w);
  matchesFixture('world.json', stored(w));
});
