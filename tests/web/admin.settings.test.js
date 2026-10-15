const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, helpers, settle } = require('../harness/dom.js');
const {
  boot,
  openAdmin,
  person,
  member,
  submit
} = require('../harness/admin-page.js');

test(
  'Team size: admin sets the minimum and maximum and students see ' +
    'exactly those choices',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(p.$('[name="teamMin"]').value, '1');
    assert.equal(p.$('[name="teamMax"]').value, '6');
    p.type('[name="teamMin"]', '2');
    p.type('[name="teamMax"]', '4');
    assert.ok(
      p.$('.size-preview').textContent.includes('2') &&
        p.$('.size-preview').textContent.includes('4')
    );
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize,
      { min: 2, max: 4 }
    );

    const stu = await openPage('index.html', w, { query: `?f=${f.slug}` });
    stu.window.App.form.init();
    await settle();
    const s = helpers(stu.window);
    s.type('[name="email"]', 'a@b.com');
    s.type('[name="leader_name"]', 'أحمد محمد محمود أحمد');
    s.type('[name="leader_code"]', '4230999');
    s.type('[name="phone"]', '01012345678');
    s.submitForm();
    await settle();
    s.pick('major', 'حاسبات');
    s.pick('level', 'صفر / الأولى');
    s.pick('section', '4C-TH1');
    s.pick('curriculum', '2020');
    s.submitForm();
    await settle();
    assert.deepEqual(
      s.$$('.size-chips input').map((i) => i.value),
      ['2', '3', '4']
    );
  }
);

test(
  'Setup: a save over a newer change is refused, and the reason and ' +
    'what was typed stay',
  async () => {
    const w = boot();
    const f = w.make('task_submission', 'Tasks');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    // Another window closes the form after this page was opened.
    w.advanceDays(0.001);
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'closed' }
    });
    p.type('[name="title"]', 'Typed here');
    p.click('[name="save"]');
    await settle(8);
    const note = p.$('.savebar-note');
    assert.match(note.textContent, /changed in another window/);
    assert.equal(note.getAttribute('role'), 'alert');
    assert.equal(
      p.$('[name="title"]').value,
      'Typed here',
      'the change is still on the page'
    );
    const kept = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.deepEqual([kept.title, kept.status], ['Tasks', 'closed']);
    p.clickText('Discard');
    await settle(10);
    p.type('[name="title"]', 'Typed again');
    p.click('[name="save"]');
    await settle(10);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.deepEqual(
      [saved.title, saved.status],
      ['Typed again', 'closed'],
      "only the title was sent, so the other window's status stays"
    );
  }
);

test(
  'Team size: an impossible range ' + 'is refused before anything is saved',
  async () => {
    const w = boot();
    const f = w.make('task_submission', 'Tasks');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    p.type('[name="teamMin"]', '5');
    p.type('[name="teamMax"]', '3');
    p.click('[name="save"]');
    await settle(8);
    assert.ok(p.text().includes('Team size needs a minimum'));
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize,
      { min: 1, max: 5 }
    );
  }
);

test(
  'Settings: status, dates, edit key, ' + 'and question labels are saved',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects', { status: 'draft' });
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const status = p
      .$$('select')
      .find((s) => [...s.options].some((o) => o.value === 'archived'));
    status.value = 'closed';
    p.fire(status, 'change');
    p.type('[name="keyDays"]', '3');
    p.type('[name="opensAt"]', '2027-10-01T09:00');
    p.fire(p.$('[name="opensAt"]'), 'change');
    const row = p.$('[data-field="title"]');
    p.type(
      row.querySelector('input[aria-label="English label for title"]'),
      'Project name'
    );
    p.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(saved.status, 'closed');
    assert.equal(saved.editKey.days, 3);
    assert.ok(saved.opensAt.startsWith('2027-10-01'));
    assert.equal(
      saved.fields.find((x) => x.id === 'title').label.en,
      'Project name'
    );
  }
);

test('Settings: required team parts cannot be switched off', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}/settings`);
  // A question that is always asked has no switches to grey out: the row says so.
  ['team_size', 'members', 'leader_code', 'leader_name'].forEach((id) => {
    assert.equal(
      p.$$(`[data-field="${id}"] input[type="checkbox"]`).length,
      0,
      id
    );
    assert.equal(
      p.$(`[data-field="${id}"] .q-show`).textContent,
      'Always asked',
      id
    );
  });
  assert.equal(
    p.$$('[data-field="link"] input[type="checkbox"]').length,
    2,
    'the Drive link can be hidden or made optional'
  );
  assert.deepEqual(
    ['team_size', 'link', 'leader_code', 'email'].map(
      (id) => p.$(`[data-field="${id}"] .q-type`).textContent
    ),
    ['Team size', 'Drive link', 'Student code', 'Email address'],
    'a type is named in plain words'
  );
});

test(
  'Small teams: the admin switches on the two warnings with their ' +
    'numbers, and a wrong order stays with its reason',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const sub = (name) => p.$(`[name="${name}"]`).closest('.sub-setting');
    assert.equal(p.$('[name="criticalAlert"]').checked, false);
    assert.equal(
      sub('criticalBelow').hidden,
      true,
      'a number shows only for a warning that is on'
    );
    assert.equal(
      p.$('[name="criticalAlert"]').closest('section').dataset.panel,
      'Small teams'
    );
    assert.equal(
      p.$('[name="criticalAlert"]').closest('section').hidden,
      false,
      'the warnings are in Setup'
    );
    assert.equal(
      p.$('[name="teamMax"]').closest('section').hidden,
      true,
      'away from the team size question'
    );
    assert.equal(
      p.$('.savebar').hidden,
      true,
      'opening the page changes nothing'
    );
    p.click('[name="criticalAlert"]');
    p.click('[name="warningAlert"]');
    assert.deepEqual(
      [p.$('[name="criticalBelow"]').value, p.$('[name="warningBelow"]').value],
      ['3', '5'],
      'the numbers start from the biggest team size'
    );
    assert.equal(sub('warningBelow').hidden, false);
    assert.equal(
      p.$('[name="size-alerts-preview"]').textContent,
      'Critical: teams of 1 or 2. Warning: teams of 3 or 4.'
    );

    p.type('[name="warningBelow"]', '3');
    assert.ok(
      p
        .$('#size-alert-warning-err')
        .textContent.includes('higher number than the critical warning')
    );
    p.click('[name="save"]');
    await settle(8);
    assert.ok(
      p
        .$('.savebar-note')
        .textContent.includes('higher number than the critical warning')
    );
    assert.equal(
      p.$('[name="warningBelow"]').value,
      '3',
      'the refused number stays in its field'
    );
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sizeAlerts,
      undefined
    );

    p.type('[name="teamMax"]', '4');
    p.type('[name="warningBelow"]', '5');
    assert.ok(
      p.$('#size-alert-warning-err').textContent.includes('from 2 to 4'),
      'the biggest team size bounds the number'
    );
    p.type('[name="teamMax"]', '6');
    assert.equal(
      p.$('#size-alert-warning-err').textContent,
      '',
      'and the reason goes when the range allows it again'
    );
    p.type('[name="criticalBelow"]', '2');
    p.type('[name="warningBelow"]', '4');
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sizeAlerts,
      { critical: { on: true, below: 2 }, warning: { on: true, below: 4 } }
    );
  }
);

test(
  'Reservation teammates: an admin can enable and disable teammate ' +
    'collection',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const field = p.$('[name="reservation-members"]');
    assert.ok(field, 'settings exposes a teammate collection toggle');
    assert.equal(
      field.checked,
      false,
      'existing reservation forms keep solo booking as the default'
    );
    field.checked = true;
    p.fire(field, 'change');
    p.click('[name="save"]');
    await settle(12);
    let saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    const members = saved.fields.find((item) => item.role === 'members');
    assert.equal(members.enabled, true);
    assert.equal(members.required, true);
    assert.ok(saved.steps.some((step) => step.fields.includes(members.id)));
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: {
        slots: {
          days: [{ id: 'one', label: 'Sunday', times: ['12:30 - 12:50'] }],
          capacity: 1
        }
      }
    });
    w.api({
      action: 'submit',
      slug: f.slug,
      data: person({
        leader_code: '4230002',
        title: 'Library',
        slot: { day: 'one', time: '12:30 - 12:50' },
        members: [member('سارة خالد حسن علي', '4230003')]
      })
    });

    const reload = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(reload.$('[name="reservation-members"]').checked, true);
    reload.$('[name="reservation-members"]').checked = false;
    reload.fire(reload.$('[name="reservation-members"]'), 'change');
    reload.click('[name="save"]');
    await settle(12);
    saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(
      saved.fields.find((item) => item.role === 'members').enabled,
      false
    );
    assert.equal(
      saved.fields.find((item) => item.role === 'members').required,
      false
    );
    const rows = w.admin({
      action: 'admin.submissions',
      slug: f.slug
    }).submissions;
    assert.deepEqual(
      rows[0].data.members,
      [],
      'disabled roster details are not exposed in submissions'
    );
  }
);

test(
  'Reservation teammates: how many, the title students read, and what ' +
    'is asked about each one',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar', {
      slots: {
        days: [
          {
            id: 'one',
            label: 'Sunday',
            times: ['12:30 - 12:50', '12:55 - 1:15']
          }
        ],
        capacity: 1
      }
    });
    const p = await openAdmin(w, `#/f/${f.slug}/questions`);
    assert.ok(
      p.$('.tm-body').hidden,
      'the settings exist only while teammates are asked'
    );
    const ask = p.$('[name="reservation-members"]');
    ask.checked = true;
    p.fire(ask, 'change');
    assert.equal(p.$('.tm-body').hidden, false);
    const choices = () => p.$('.tm-body .size-preview').textContent;
    assert.equal(
      choices(),
      'A leader can bring: 12345 teammates',
      'the same control as the team size'
    );
    p.type('[name="teammatesMin"]', '0');
    p.type('[name="teammatesMax"]', '2');
    assert.equal(
      choices(),
      'A leader can bring: 012 teammates',
      'a leader may book alone'
    );
    p.type('[name="teammatesMin"]', '3');
    p.click('[name="save"]');
    await settle(8);
    assert.ok(
      p
        .text()
        .includes(
          'The number of teammates needs a minimum of at least 0 and a maximum that is not lower and at least 1, up to 19.'
        ),
      'a range upside down is refused'
    );
    p.type('[name="teammatesMin"]', '0');
    p.click('[name="teammates-notice-size-0"]');
    p.type(
      '[name="teammates-noticeEn"]',
      'Other students may join you, up to {max}.'
    );
    assert.ok(
      p
        .$('.tm-body .notice-preview')
        .textContent.includes('Other students may join you, up to 2.'),
      'the note is previewed as the team size note is'
    );
    p.type('[name="teammates-title-en"]', 'Who comes with you');
    const phone = p.$('.tm-questions [data-field="phone"] .q-show input');
    phone.checked = false;
    p.fire(phone, 'change');
    assert.equal(
      p.$('.tm-questions [data-field="name"] .q-show').textContent,
      'Always asked'
    );
    p.click('[name="save"]');
    await settle(12);

    const members = w
      .admin({ action: 'admin.forms.get', id: f.id })
      .form.fields.find((x) => x.role === 'members');
    assert.deepEqual(
      [
        members.enabled,
        members.required,
        members.min,
        members.max,
        members.label.en
      ],
      [true, false, 0, 2, 'Who comes with you']
    );
    assert.deepEqual(members.notice, {
      sizes: [0],
      text: { en: 'Other students may join you, up to {max}.', ar: '' }
    });
    assert.equal(members.fields.find((x) => x.id === 'phone').enabled, false);
    const book = (code, time, list) =>
      w.api({
        action: 'submit',
        slug: f.slug,
        data: person({
          leader_code: code,
          title: 'Library',
          slot: { day: 'one', time },
          members: list
        })
      });
    assert.equal(
      book('4230010', '12:30 - 12:50', []).ok,
      true,
      'a leader books alone'
    );
    const three = ['4230011', '4230012', '4230013'].map((c) =>
      member('سارة خالد حسن علي', c)
    );
    assert.equal(
      book('4230020', '12:55 - 1:15', three).ok,
      false,
      'more teammates than the most is refused'
    );
    const noPhone = { ...member('سارة خالد حسن علي', '4230021') };
    delete noPhone.phone;
    assert.equal(
      book('4230020', '12:55 - 1:15', [noPhone]).ok,
      true,
      'a hidden detail is not needed'
    );

    // The saved bookings that a new range leaves outside are counted before the save, as saved teams are.
    const again = await openAdmin(w, `#/f/${f.slug}/questions`);
    const outside = () => again.$('[name="teammates-conflicts"]');
    assert.ok(outside().hidden, 'both bookings fit 0 to 2');
    again.type('[name="teammatesMin"]', '1');
    assert.equal(
      outside().textContent,
      '1 saved booking is outside 1 to 2. It stays booked as it is. Widen the range, or ask that team to change their teammates.'
    );
  }
);

test(
  'Team size note: the admin picks sizes, writes the note, and it is ' +
    'saved',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects', {
      rules: { teamSize: { min: 1, max: 5 } }
    });
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    p.click('[name="notice-size-3"]');
    p.click('[name="notice-size-4"]');
    assert.equal(
      p.$('[name="notice-size-3"]').getAttribute('aria-pressed'),
      'true'
    );
    p.click('[name="save"]');
    await settle(8);
    assert.ok(
      p.text().includes('Write the note for team size'),
      'sizes without text are refused'
    );
    p.type('[name="noticeEn"]', 'Others join to reach {max}.');
    assert.ok(
      p.$('.notice-preview').textContent.includes('Others join to reach 5.'),
      'live preview fills the placeholders'
    );
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.teamSize
        .notice,
      { sizes: [3, 4], text: { en: 'Others join to reach {max}.', ar: '' } }
    );
  }
);

test(
  'Who can register: picking one ' + 'specialization saves it, All clears it',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(
      p.$('[name="major-all"]').getAttribute('aria-pressed'),
      'true'
    );
    p.click('[name="major-حاسبات"]');
    assert.ok(p.text().includes('Only Computers students can register'));
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.majors,
      ['حاسبات']
    );
    const q = await openAdmin(w, `#/f/${f.slug}/settings`);
    q.click('[name="major-all"]');
    q.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.majors,
      []
    );
  }
);

test(
  'Settings: saving project and task forms preserves enabled teammate ' +
    'collection',
  async () => {
    for (const type of ['team_registration', 'task_submission']) {
      const w = boot();
      const f = w.make(type, 'Teams');
      const p = await openAdmin(w, `#/f/${f.slug}/settings`);
      p.click('[name="save"]');
      await settle(12);
      const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
      const members = saved.fields.find((field) => field.role === 'members');
      assert.notEqual(members.enabled, false);
      assert.equal(members.required, true);
      p.dom.window.close();
    }
  }
);

test(
  'Setup: a section shows what it is set to, and the save bar exists ' +
    'only while there is a change',
  async () => {
    const w = boot();
    const f = w.admin({
      action: 'admin.forms.create',
      type: 'team_registration',
      title: 'Teams',
      term: 'Fall 2027'
    }).form;
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const key = p.$('[data-panel="Edit key"]');
    assert.equal(
      key.querySelector('.panel-head').getAttribute('aria-expanded'),
      'false'
    );
    assert.ok(key.querySelector('.panel-body').hidden);
    assert.equal(
      key.querySelector('.panel-sum').textContent,
      'On, 7 days, students can edit and cancel'
    );
    assert.ok(p.$('.savebar').hidden, 'nothing to save yet');
    assert.equal(p.win.App.admin.unsaved, false);

    p.click(key.querySelector('.panel-head'));
    assert.equal(key.querySelector('.panel-body').hidden, false);
    p.type('[name="keyDays"]', '3');
    assert.equal(
      key.querySelector('.panel-sum').textContent,
      'On, 3 days, students can edit and cancel'
    );
    assert.equal(p.$('.savebar').hidden, false);
    assert.equal(p.win.App.admin.unsaved, true);
    p.type('[name="keyDays"]', '7');
    assert.ok(
      p.$('.savebar').hidden,
      'back to the saved value, so there is nothing to save'
    );

    p.type('[name="keyDays"]', '5');
    p.click('[name="save"]');
    await settle(12);
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.editKey.days,
      5
    );
    assert.ok(p.$('.savebar').hidden);
    assert.equal(
      p.$('[data-panel="Edit key"] .panel-body').hidden,
      false,
      'a section stays open after a save'
    );

    p.type('[name="teamMin"]', '9');
    p.click('[name="tab-settings"]');
    p.click('[name="save"]');
    await settle(8);
    assert.equal(
      p.$('[name="tab-questions"]').getAttribute('aria-current'),
      'page',
      'a refused save opens the tab and the section with the problem'
    );
    assert.equal(p.$('[data-panel="Team size"] .panel-body').hidden, false);
  }
);

test(
  'Who can register: sections are picked one by one or a whole year ' +
    'group at once',
  async () => {
    const w = boot();
    const lists = w.admin({ action: 'admin.lists.get' }).lists;
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    const who = p.$('[data-panel="Who can register"]');
    assert.equal(who.querySelector('.panel-sum').textContent, 'Everyone');
    assert.equal(
      p.$('[name="section-all"]').getAttribute('aria-pressed'),
      'true'
    );
    p.click('[name="section-4C-TH1"]');
    p.click('[name="section-4C-O2"]');
    assert.equal(
      who.querySelector('.panel-sum').textContent,
      '2 sections (4C)'
    );
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sections,
      ['4C-TH1', '4C-O2']
    );

    p.click('[name="section-group-4C"]');
    assert.equal(
      p.$('[name="section-all"]').getAttribute('aria-pressed'),
      'true',
      'every section chosen is the same as no limit'
    );
    p.click('[name="save"]');
    await settle(12);
    assert.deepEqual(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.rules.sections,
      []
    );
    assert.ok(lists.sections.length > 2);
  }
);

test(
  'Setup: Extend keys gives the expired keys, or chosen teams, more ' + 'time',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    submit(w, f, person({ leader_code: '4230001', title: 'Old', members: [] }));
    w.setNow(w.nowMs + 10 * 86400000);
    submit(
      w,
      f,
      person({ leader_code: '4230002', title: 'Library', members: [] })
    );
    submit(
      w,
      f,
      person({ leader_code: '4230003', title: 'Clinic', members: [] })
    );
    const keys = () =>
      w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
    const before = keys();
    const p = await openAdmin(w, '#/f/' + f.slug + '/settings');
    p.click('[data-panel="Edit key"] .panel-head');
    await settle(4);
    assert.ok(p.$('.keys-summary').textContent.includes('1 expired'));
    p.click('[name="extend-keys"]');
    await settle(8);
    assert.equal(
      p.$('[name="which-expired"]').getAttribute('aria-pressed'),
      'true',
      'expired keys are picked first'
    );
    assert.equal(
      p.$('[name="which-soon"]'),
      null,
      'a filter with nothing in it is not offered'
    );
    assert.equal(p.$('[name="extend-go"]').textContent, 'Extend key');
    p.click('[name="extend-go"]');
    await settle(10);
    const after = keys();
    assert.equal(after[0].expired, false);
    assert.equal(after[1].keyExpires, before[1].keyExpires);
    assert.ok(
      p.$('.keys-summary').textContent.includes('all working'),
      'the line is counted again'
    );

    p.click('[name="extend-keys"]');
    await settle(8);
    p.click('[name="which-chosen"]');
    await settle(1);
    assert.equal(
      p.$('[name="extend-go"]').disabled,
      true,
      'nothing chosen yet'
    );
    p.type('[name="key-search"]', 'clinic');
    await settle(1);
    assert.equal(p.$$('.key-row').length, 1);
    p.click('[name="choose-shown"]');
    await settle(1);
    p.click('[name="extend-30"]');
    await settle(1);
    assert.ok(p.$('.extend-preview').textContent.includes('will work until'));
    p.click('[name="extend-go"]');
    await settle(10);
    const last = keys();
    assert.equal(
      Date.parse(last[2].keyExpires) - Date.parse(before[2].keyExpires),
      30 * 86400000
    );
    assert.equal(last[1].keyExpires, before[1].keyExpires);
  }
);

test(
  'Team size: the panel counts the saved teams a new range leaves ' +
    'outside, before the save',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    submit(w, f, person({ title: 'Alpha' }));
    submit(
      w,
      f,
      person({
        leader_code: '4230010',
        title: 'Beta',
        members: [
          member('سارة خالد حسن علي', '4230011'),
          member('منى أشرف كمال فؤاد', '4230012')
        ]
      })
    );
    const p = await openAdmin(w, `#/f/${f.slug}/questions`);
    const note = () => p.$('[name="size-conflicts"]');
    assert.ok(note().hidden, 'every saved team fits the range');
    p.type('[name="teamMin"]', '2');
    assert.equal(note().hidden, false);
    assert.ok(note().textContent.startsWith('1 saved team is outside 2 to '));
    p.type('[name="teamMin"]', '4');
    p.type('[name="teamMax"]', '4');
    assert.ok(note().textContent.startsWith('2 saved teams are outside 4.'));
    p.type('[name="teamMin"]', '2');
    p.type('[name="teamMax"]', '5');
    p.click('[name="save"]');
    await settle(12);
    assert.equal(
      p.$$('.toast-err').length,
      0,
      'the save says nothing the panel did not say'
    );
    assert.ok(
      note().textContent.startsWith('1 saved team is outside 2 to 5.'),
      'the count is still in its panel after the save'
    );
  }
);
