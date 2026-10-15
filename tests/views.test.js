const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot(type, patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Views',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  // The views are painted by the run a change books, so reading one lets that run happen first.
  w.view = (name) => {
    w.runTriggers();
    return w.sheet(form.sheetId, name);
  };
  return w;
}

const member = (name, code) => ({
  name,
  phone: '01112345678',
  code,
  level: 'صفر / الأولى',
  curriculum: '2020',
  section: '4C-TH1'
});
const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const person = (o) =>
  sized({
    email: 'a@b.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: '4230001',
    phone: '01012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    ...o
  });

test('Team list: every team is a block with its members, star on the leader, merged linked task', () => {
  const w = boot('task_submission');
  const link = (c) => `https://docs.google.com/presentation/d/${ID(c)}/edit`;
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      title: 'Normalization',
      link: link('a'),
      members: [member('سارة خالد حسن علي', '4230002')]
    })
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      leader_code: '4230010',
      leader_name: 'عمر يوسف إبراهيم سعيد',
      title: 'ER Diagram',
      link: link('b'),
      members: [
        member('منى أشرف كمال فؤاد', '4230011'),
        member('كريم هشام عادل نصر', '4230012')
      ]
    })
  });

  const rows = w.view('Team Members List').rows();
  assert.deepEqual(rows[0], ['Team member name', 'Section', 'Code', 'Task']);
  assert.equal(rows.length, 6);
  assert.equal(rows[1][0], '1.  أحمد محمد محمود أحمد  \u2605');
  assert.equal(rows[1][1], '4C-TH1');
  assert.equal(rows[2][0], '2.  سارة خالد حسن علي');
  assert.equal(rows[2][1], '4C-TH1');
  assert.equal(rows[2][2], '4230002');
  assert.equal(rows[3][0], '1.  عمر يوسف إبراهيم سعيد  \u2605');
  assert.equal(rows[5][0], '3.  كريم هشام عادل نصر');
  assert.equal(rows[1][3], `=HYPERLINK("${link('a')}","Normalization")`);
  assert.equal(rows[2][3], '', 'merged cell body stays empty');
  assert.equal(rows[3][3], `=HYPERLINK("${link('b')}","ER Diagram")`);
});

test('Team list: projects without a link show plain text and the header says Project', () => {
  const w = boot('team_registration');
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ title: 'Library System', members: [] })
  });
  const rows = w.view('Team Members List').rows();
  assert.equal(rows[0][3], 'Project');
  assert.equal(rows[1][3], 'Library System');
});

test('Team list: deleted teams disappear and an empty form says so', () => {
  const w = boot('team_registration');
  const r = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ title: 'Library System', members: [] })
  });
  w.api({ action: 'remove', slug: w.form.slug, key: r.key });
  assert.equal(
    w.view('Team Members List').rows()[1][0],
    'No registrations yet.'
  );
});

test('Bookings: grouped by day, ordered by timetable, day label on the first row of each block', () => {
  const w = boot('reservation', {
    slots: {
      days: [
        { label: 'Week 11 - Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] },
        { label: 'Week 11 - Tuesday', times: ['12:30 - 12:50'] }
      ],
      capacity: 1
    }
  });
  const book = (code, day, time, title) =>
    w.api({
      action: 'submit',
      slug: w.form.slug,
      data: person({ leader_code: code, title, slot: { day, time } })
    });
  book('4230003', 'week-11-tuesday', '12:30 - 12:50', 'Third');
  book('4230002', 'week-11-sunday', '12:55 - 1:15', 'Second');
  book('4230001', 'week-11-sunday', '12:30 - 12:50', 'First');
  const rows = w.view('Bookings').rows();
  assert.deepEqual(rows[0], [
    'Day',
    'Time',
    'Team leader',
    'Code',
    'Phone',
    'Project'
  ]);
  assert.deepEqual(
    rows.slice(1).map((r) => r[5]),
    ['First', 'Second', 'Third']
  );
  assert.equal(rows[1][0], 'Week 11 - Sunday');
  assert.equal(rows[2][0], '');
  assert.equal(rows[3][0], 'Week 11 - Tuesday');
});

test('Bookings: teammate names appear in the sheet view only when collection is enabled', () => {
  const w = boot('reservation', {
    slots: {
      days: [{ label: 'Sunday', times: ['12:30 - 12:50'] }],
      capacity: 2
    }
  });
  const form = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  w.admin({
    action: 'admin.forms.update',
    id: w.form.id,
    patch: {
      fields: form.fields.map((field) =>
        field.role === 'members' ? { ...field, enabled: true } : field
      ),
      steps: form.steps.map((step) =>
        step.id === 'project'
          ? { ...step, fields: step.fields.concat('members') }
          : step
      )
    }
  });
  const name = 'سارة خالد حسن علي';
  const result = w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      title: 'Seminar project',
      slot: { day: 'sunday', time: '12:30 - 12:50' },
      members: [member(name, '4230002')]
    })
  });
  assert.equal(result.ok, true);
  const rows = w.view('Bookings').rows();
  assert.deepEqual(rows[0], [
    'Day',
    'Time',
    'Team leader',
    'Code',
    'Phone',
    'Project',
    'Teammates'
  ]);
  assert.equal(rows[1][6], name);
});

test('Bookings: legacy reservations gain disabled teammate metadata before views and printing', () => {
  const w = boot('reservation', {
    slots: {
      days: [{ id: 'sunday', label: 'Sunday', times: ['12:30 - 12:50'] }],
      capacity: 1
    }
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      title: 'Solo project',
      slot: { day: 'sunday', time: '12:30 - 12:50' }
    })
  });

  const forms = w.registry.getSheetByName('Forms');
  const config = JSON.parse(forms.rows()[1][10]);
  config.fields = config.fields.filter((field) => field.role !== 'members');
  config.steps = config.steps.map((step) => ({
    ...step,
    fields: step.fields.filter((id) => id !== 'members')
  }));
  forms.getRange(2, 11).setValue(JSON.stringify(config));

  const legacy = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
  const members = legacy.fields.find((field) => field.role === 'members');
  assert.ok(
    members,
    'legacy reservation receives the teammate field definition'
  );
  assert.equal(members.enabled, false, 'legacy reservations remain solo-only');
  assert.ok(
    legacy.steps
      .find((step) => step.id === 'project')
      .fields.includes(members.id)
  );

  w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.deepEqual(w.view('Bookings').rows()[0], [
    'Day',
    'Time',
    'Team leader',
    'Code',
    'Phone',
    'Project'
  ]);
  const printed = w.admin({
    action: 'admin.print.reservations',
    slug: w.form.slug,
    dayId: 'sunday'
  });
  assert.deepEqual(w.view(printed.sheetName).rows()[2], [
    'No.',
    'Time',
    'Team leader',
    'Code',
    'Project',
    'Signature'
  ]);
});

test('Registrations: WhatsApp rows sorted by group and section with review text and link', () => {
  const w = boot('whatsapp_registration');
  const reg = (code, group, section, phone) =>
    w.api({
      action: 'submit',
      slug: w.form.slug,
      data: {
        email: 'a@b.com',
        name: 'أحمد محمد محمود أحمد',
        phone,
        code,
        level: 'صفر / الأولى',
        major: 'حاسبات',
        group,
        section,
        schedule: `https://drive.google.com/file/d/${ID('s')}/view`
      }
    });
  reg('4230001', 'B', '3', '01012345671');
  reg('4230002', 'A', '21', '01012345672');
  reg('4230003', 'A', '4', '01012345673');
  const rows = w.view('Registrations').rows();
  assert.deepEqual(
    rows.slice(1).map((r) => r[2]),
    ['4230003', '4230002', '4230001']
  );
  assert.equal(rows[1][7], 'Timetable check: pending  |  Group match: pending');
  assert.ok(rows[1][6].startsWith('=HYPERLINK('));
});

const marked = (w) => [...w.props.keys()].filter((k) => k.startsWith('dirty:'));

test('Views: changes book one run a minute later, which paints the view and removes itself', () => {
  const w = boot('team_registration');
  assert.deepEqual(w.triggers, [], 'nothing is booked while nothing changed');
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ title: 'One', members: [] })
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ leader_code: '4230099', title: 'Two', members: [] })
  });
  assert.deepEqual(
    w.triggers.map((t) => [t.fn, t.kind, t.arg]),
    [['processDirtyViews', 'after', 60000]],
    'two changes, one run'
  );
  assert.equal(
    w.sheet(w.form.sheetId, 'Team Members List'),
    null,
    'the submission did not wait for the view'
  );
  assert.equal(marked(w).length, 1);
  assert.equal(w.runTriggers(), 1);
  assert.equal(w.sheet(w.form.sheetId, 'Team Members List').rows().length, 3);
  assert.deepEqual(
    [w.triggers.length, marked(w).length],
    [0, 0],
    'the run left nothing behind'
  );
  assert.equal(
    w.runTriggers(),
    0,
    'and nothing runs again until the next change'
  );
});

test('Views: a repaint that fails keeps its mark, and the timer of an older version is removed', () => {
  const w = boot('team_registration');
  // A deployment made before this version left a run every five minutes.
  w.triggers.push({
    fn: 'processDirtyViews',
    id: 'old',
    kind: 'everyMinutes',
    arg: 5
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ title: 'One', members: [] })
  });
  assert.equal(w.triggers.length, 1, 'a booked run is not booked twice');
  const sheet = w.spreadsheets.get(w.form.sheetId);
  w.spreadsheets.delete(w.form.sheetId);
  w.runTriggers();
  assert.deepEqual(
    [w.triggers.length, marked(w).length],
    [0, 1],
    'the old timer is gone and the form is still marked'
  );
  w.spreadsheets.set(w.form.sheetId, sheet);
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ leader_code: '4230099', title: 'Two', members: [] })
  });
  w.runTriggers();
  assert.equal(w.sheet(w.form.sheetId, 'Team Members List').rows().length, 3);
  assert.equal(marked(w).length, 0);
});

test('Views: a change that arrives while a form is painted books one more run', () => {
  const w = boot('team_registration');
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({ title: 'One', members: [] })
  });
  // The second team registers after the run read its marks and before it finished.
  const real = w.ctx.rebuildViews;
  w.ctx.rebuildViews = (form) => {
    w.ctx.rebuildViews = real;
    w.advanceDays(0.001);
    w.api({
      action: 'submit',
      slug: w.form.slug,
      data: person({ leader_code: '4230099', title: 'Two', members: [] })
    });
    return real(form);
  };
  w.runTriggers();
  assert.deepEqual(
    [w.triggers.length, marked(w).length],
    [1, 1],
    'the newer mark is kept and a run is booked for it'
  );
  w.runTriggers();
  assert.deepEqual([w.triggers.length, marked(w).length], [0, 0]);
});

test('Admin: rebuild on demand returns the sheet link', () => {
  const w = boot('team_registration');
  const r = w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.equal(r.rebuilt, true);
  assert.ok(r.sheetUrl.includes(w.form.sheetId));
});

/* ── Data tabs ────────────────────────────────────────────────── */

const INK = '#3A2A1A';
const looks = (sheet, cols) => ({
  head: Array.from({ length: cols }, (_, i) =>
    sheet.backgrounds.get('1,' + (i + 1))
  ).every((c) => c === INK),
  frozen: sheet.frozenRows,
  bands: sheet.bandings.map((b) => [
    b.getRange().getNumRows(),
    b.getRange().getNumColumns(),
    b.HeaderRow,
    b.FirstRow,
    b.SecondRow
  ])
});
const plain = (sheet) => {
  sheet.backgrounds.clear();
  sheet.widths.clear();
  sheet.bandings = [];
  sheet.frozenRows = 0;
};

test('Data tabs: the registry and a new form get the header, the widths and the row tints', () => {
  const w = boot('team_registration');
  const tinted = (cols) => ({
    head: true,
    frozen: 1,
    bands: [[1000, cols, INK, '#FFFFFF', '#F8F1DE']]
  });
  assert.deepEqual(looks(w.registry.getSheetByName('Forms'), 13), tinted(13));
  assert.deepEqual(looks(w.registry.getSheetByName('Clients'), 12), tinted(12));
  assert.deepEqual(looks(w.registry.getSheetByName('Lists'), 2), tinted(2));
  const responses = w.sheet(w.form.sheetId, 'Responses');
  assert.deepEqual(looks(responses, 20), tinted(20));
  assert.equal(responses.widths.get(8), 240, 'the name column is wide');
  assert.equal(responses.widths.get(20), 80, 'the number column is narrow');
  assert.deepEqual(
    responses.rows()[0].slice(0, 3),
    ['id', 'ref', 'created'],
    'the header still holds the column names'
  );
});

test('Data tabs: a sheet made before the look existed gets it on the next repaint, and no value changes', () => {
  const w = boot('whatsapp_registration', {
    matching: { enabled: true, step: 'group' }
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      name: 'أحمد محمد محمود أحمد',
      code: '4230001',
      phone: '01012345678',
      level: 'صفر / الأولى',
      group: 'G1',
      section: '4C-TH1'
    }
  });
  w.admin({
    action: 'admin.matching.import',
    slug: w.form.slug,
    text: '01012345678 Ahmed'
  });
  const responses = w.sheet(w.form.sheetId, 'Responses'),
    requests = w.sheet(w.form.sheetId, 'Requests');
  w.runTriggers();
  plain(responses);
  plain(requests);
  const before = JSON.stringify([
    responses.rows(),
    requests.rows(),
    [...responses.formats]
  ]);

  w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.equal(looks(responses, 20).head, true);
  assert.deepEqual(
    looks(requests, 7),
    { head: true, frozen: 1, bands: [[1000, 7, INK, '#FFFFFF', '#F8F1DE']] },
    'a tab only some forms have is dressed too'
  );
  assert.equal(
    JSON.stringify([responses.rows(), requests.rows(), [...responses.formats]]),
    before,
    'values and number formats are untouched'
  );

  const band = responses.bandings[0];
  w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.equal(responses.bandings[0], band, 'a dressed tab is left alone');
  responses.backgrounds.delete('1,20');
  w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
  assert.deepEqual(
    [
      responses.bandings.length,
      responses.bandings[0] === band,
      looks(responses, 20).head
    ],
    [1, false, true],
    'a column added later is dressed with the rest'
  );
});

test('Data tabs: a tab that refuses the look is still repainted', () => {
  const w = boot('task_submission');
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      title: 'Normalization',
      link: `https://docs.google.com/presentation/d/${ID('a')}/edit`,
      members: [member('سارة خالد حسن علي', '4230002')]
    })
  });
  const responses = w.sheet(w.form.sheetId, 'Responses');
  plain(responses);
  responses.getBandings = () => {
    throw new Error('refused');
  };

  assert.equal(
    w.admin({ action: 'admin.views.rebuild', slug: w.form.slug }).ok,
    true
  );
  assert.equal(
    w.sheet(w.form.sheetId, 'Team Members List').rows().length,
    3,
    'the view is painted'
  );
  assert.equal(
    responses.bandings.length,
    0,
    'the tab stays without its row tints'
  );
});
