const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, openAdmin } = require('../harness/admin-page.js');

test(
  'Lists: a plain list is chips, and the save bar exists only while it ' +
    'differs from the saved copy',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '#/lists');
    assert.ok(
      p.$('.lists') && !p.$('.lists').classList.contains('picked'),
      'no list in the address: a phone shows the lists'
    );
    assert.ok(
      p
        .$('[name="pick-sections"]')
        .textContent.includes('4C-TH1, 4C-TH2, 4C-TH3, 4C-TH4 …'),
      'a card names the first choices'
    );
    p.click('[name="pick-groups"]');
    await settle(2);
    assert.ok(p.$('.lists').classList.contains('picked'));
    assert.equal(p.win.location.hash, '#/lists/groups');
    assert.ok(p.$('.value-chips'), 'plain values are chips');
    assert.equal(p.$('[name="new-en"]'), null, 'chips ask for the choice only');
    assert.ok(p.$('.savebar').hidden, 'nothing to save yet');
    p.type('[name="new-value"]', 'C');
    p.$('[name="new-value"]').dispatchEvent(
      new p.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    assert.equal(p.$('.savebar').hidden, false);
    assert.ok(
      p.$('.savebar').textContent.includes('Groups: 1 added. Not saved yet.')
    );
    assert.ok(p.$('[name="pick-groups"]').textContent.includes('Not saved'));
    p.click('[name="remove-2"]');
    assert.ok(
      p.$('.savebar').hidden,
      'back to the saved choices, so the bar is gone'
    );
    p.type('[name="new-value"]', 'C');
    p.click('[name="add-choice"]');
    p.click('[name="save-list"]');
    await settle(8);
    assert.deepEqual(
      w.admin({ action: 'admin.lists.get' }).lists.groups.map((o) => o.value),
      ['A', 'B', 'C']
    );
    assert.ok(p.$('.savebar').hidden);
    p.click('[name="all-lists"]');
    assert.equal(p.win.location.hash, '#/lists');
    assert.ok(!p.$('.lists').classList.contains('picked'));
  }
);

test(
  'Lists: a list with English names is rows that can be added to and ' +
    'reordered, and every form follows',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, '#/lists/majors');
    assert.ok(
      p.$('.lists').classList.contains('picked'),
      'the address opens the list'
    );
    assert.ok(p.$('[name="en-0"]'), 'named choices are rows');
    assert.equal(
      p.$('[name="ar-0"]'),
      null,
      'no Arabic name column while no choice has one'
    );
    assert.equal(
      p.$('[name="edit-rows"]') || p.$('[name="short-view"]'),
      null,
      'named choices have no short view'
    );
    assert.ok(
      p.$('.used-by').textContent.includes('Projects'),
      'the forms that ask the list are named'
    );
    p.type('[name="new-value"]', 'كهرباء');
    p.type('[name="new-en"]', 'Power');
    p.click('[name="add-choice"]');
    p.click('.choice[data-i="5"] [aria-label="Move up"]');
    p.click('[name="save-list"]');
    await settle(8);
    const major = w
      .api({ action: 'getForm', slug: f.slug })
      .form.fields.find((x) => x.id === 'major');
    assert.deepEqual(
      major.options.map((o) => o.label.en),
      [
        'Computers',
        'Communications',
        'Architecture',
        'Mechanical',
        'Power',
        'Civil'
      ]
    );
  }
);

test(
  'Lists: a refused save says why next to the choices, and a removed ' +
    'choice names the form limited to it',
  async () => {
    const w = boot();
    w.make('team_registration', 'Projects', { rules: { majors: ['حاسبات'] } });
    const p = await openAdmin(w, '#/lists/majors');
    p.type('[name="value-1"]', 'حاسبات');
    assert.ok(
      p.text().includes('"حاسبات" is in the list twice. Remove one of them.')
    );
    assert.ok(
      p.$('.choice[data-i="1"]').classList.contains('bad'),
      'the row is marked'
    );
    assert.equal(
      p.$('[name="value-1"]').value,
      'حاسبات',
      'the refused value stays in its field'
    );
    p.click('[name="save-list"]');
    await settle(8);
    assert.equal(
      w.admin({ action: 'admin.lists.get' }).lists.majors[1].value,
      'اتصالات',
      'nothing was saved'
    );
    p.click('[name="discard"]');
    p.click('[name="remove-0"]');
    assert.ok(
      p.$('.savebar').textContent.includes('Majors: 1 removed. Not saved yet.')
    );
    assert.ok(
      p
        .$('.savebar-warn')
        .textContent.includes('Limited to a removed choice: Projects.')
    );
    p.click('[name="discard"]');
    assert.ok(p.$('.savebar').hidden);

    p.click('[name="pick-groups"]');
    await settle(2);
    p.click('[name="remove-0"]');
    p.click('[name="remove-0"]');
    assert.ok(p.text().includes('A list needs at least one choice.'));
    p.click('[name="pick-levels"]');
    await settle(2);
    assert.ok(
      p.text().includes('Leave without saving?'),
      'another list is opened only after the admin agrees'
    );
  }
);

test(
  'Lists: a year group is added from its own card, with the counts the ' +
    'admin sets and nothing copied',
  async () => {
    const w = boot();
    w.make('team_registration', 'Projects', { rules: { sections: ['4C-O3'] } });
    const p = await openAdmin(w, '#/lists/sections');
    assert.equal(
      p.$('[name="count-4C-TH"]').value,
      '8',
      'the saved list reads as 4C with 8 TH, 3 T and 3 O'
    );
    assert.equal(p.$('[name="count-4C-O"]').value, '3');
    assert.ok(p.$('.savebar').hidden);
    assert.equal(
      p.$('[name="group-draft"]'),
      null,
      'nothing about adding is open until it is asked for'
    );
    p.click('[name="add-group-open"]');
    assert.equal(p.$('[name="add-group-open"]'), null);
    assert.equal(
      p.$('[name="add-group"]'),
      null,
      'Add appears once the group can be added'
    );
    assert.equal(
      p.$('[name="group-missing"]').textContent,
      'Pick a year and a department letter.'
    );
    assert.deepEqual(
      p.$$('[name^="group-year-"]').map((n) => n.textContent),
      ['1', '2', '3', '4', '5']
    );
    assert.deepEqual(
      p.$$('[name^="group-letter-"]').map((n) => n.textContent),
      ['C', '+ New letter'],
      'the letters are the ones the lists use'
    );
    assert.deepEqual(
      p
        .$$('[name^="draft-count-"].stepper-input')
        .map((n) => [n.name, n.value]),
      [
        ['draft-count-TH', '0'],
        ['draft-count-T', '0'],
        ['draft-count-O', '0']
      ],
      'every kind of the lists starts at 0'
    );
    p.click('[name="group-year-3"]');
    assert.equal(
      p.$('[name="group-missing"]').textContent,
      'Pick a department letter.'
    );
    p.click('[name="group-letter-add"]');
    p.type('[name="group-letter-new"]', 'l');
    assert.equal(
      p.$('[name="group-missing"]').textContent,
      'Set at least one kind above 0.'
    );
    p.type('[name="draft-count-TH"]', '6');
    p.type('[name="draft-count-T"]', '3');
    assert.equal(p.$('[name="group-missing"]').textContent, '');
    assert.equal(
      p.$('[name="add-group"]').textContent,
      'Add 3L',
      'the button names the group, and nothing else is taken from 4C'
    );
    assert.ok(
      p.$('.savebar').hidden,
      'a group being drawn is not a change yet'
    );
    p.$('[name="draft-count-T"]').dispatchEvent(
      new p.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    assert.equal(
      p.$('[name="group-draft"]'),
      null,
      'Enter in a count adds the group'
    );
    assert.deepEqual(
      p.$$('[data-group]').map((g) => g.dataset.group),
      ['3L', '4C'],
      'a new group goes in year order'
    );
    assert.equal(p.$('[name="count-3L-TH"]').value, '6');
    assert.equal(
      p.$('[name="count-3L-O"]'),
      null,
      'a kind left at 0 is not in the group'
    );
    assert.equal(
      p.$('[name="group-letter-L"]'),
      null,
      'the typed letter is used by a group, not kept as a chip of its own'
    );
    p.click('[name="count-4C-O-down"]');
    assert.ok(
      p
        .$('.savebar')
        .textContent.includes('Sections: 9 added, 1 removed. Not saved yet.')
    );
    assert.ok(
      p
        .$('.savebar-warn')
        .textContent.includes('Limited to a removed choice: Projects.')
    );
    p.click('[name="add-group-open"]');
    assert.ok(
      p.$('[name="group-letter-L"]'),
      'once a group uses a letter, it is a chip'
    );
    p.click('[name="group-year-4"]');
    p.click('[name="group-letter-C"]');
    p.type('[name="draft-count-TH"]', '1');
    assert.equal(
      p.$('[name="group-missing"]').textContent,
      '4C is already in this list.'
    );
    assert.equal(p.$('[name="add-group"]'), null);
    p.click('[name="add-group-cancel"]');
    assert.equal(p.$('[name="group-draft"]'), null);
    p.click('[name="save-list"]');
    await settle(8);
    const saved = w
      .admin({ action: 'admin.lists.get' })
      .lists.sections.map((o) => o.value);
    assert.equal(saved.length, 22);
    assert.deepEqual(saved.slice(0, 9), [
      '3L-TH1',
      '3L-TH2',
      '3L-TH3',
      '3L-TH4',
      '3L-TH5',
      '3L-TH6',
      '3L-T1',
      '3L-T2',
      '3L-T3'
    ]);
  }
);

test(
  'Lists: a kind is added by name or removed with its own button, and ' +
    'a count never reaches 0',
  async () => {
    const w = boot();
    w.admin({
      action: 'admin.lists.set',
      key: 'sections',
      values: ['4C-TH1', '4C-TH2', '4C-T1', '4C-TH01']
    });
    const p = await openAdmin(w, '#/lists/sections');
    assert.deepEqual(
      p.$$('[name^="count-4C-"].stepper-input').map((n) => n.name),
      ['count-4C-TH', 'count-4C-T']
    );
    assert.ok(
      p.text().includes('4C-TH01'),
      'a number written with a leading zero is kept as written, under ' +
        'Other sections'
    );
    assert.equal(
      p.$('[name="count-4C-T-down"]').disabled,
      true,
      'a count stops at 1'
    );
    p.type('[name="count-4C-T"]', '0');
    assert.equal(
      p.$('[name="count-4C-T"]').value,
      '1',
      'a typed 0 is taken as 1'
    );
    p.click('[name="kind-4C-add"]');
    p.type('[name="kind-4C-new"]', 't');
    p.click('[name="kind-4C-take"]');
    assert.equal(
      p.$('#kind-4C-err').textContent,
      'T is already a kind.',
      'a kind that exists is refused with the reason'
    );
    assert.equal(
      p.$('[name="kind-4C-new"]').value,
      'T',
      'and stays in its field'
    );
    p.type('[name="kind-4C-new"]', 'lab');
    p.click('[name="kind-4C-take"]');
    assert.equal(
      p.$('[name="count-4C-LAB"]').value,
      '1',
      'a typed kind is added in capitals with one section'
    );
    p.click('[name="remove-kind-4C-T"]');
    assert.equal(p.$('[name="count-4C-T"]'), null);
    assert.ok(
      p.$('[name="add-kind-4C-T"]'),
      'a removed kind can be added back'
    );
    p.click('[name="remove-kind-4C-TH"]');
    assert.equal(
      p.$('[name="remove-kind-4C-LAB"]'),
      null,
      'the last kind of a group has no remove of its own: it goes with ' +
        'the group'
    );
    p.click('[name="save-list"]');
    await settle(8);
    assert.deepEqual(
      w.admin({ action: 'admin.lists.get' }).lists.sections.map((o) => o.value),
      ['4C-LAB1', '4C-TH01']
    );
  }
);

test('Lists: a run of numbers is set with two steppers', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/lists/wa_sections');
  assert.equal(p.$('[name="range-to"]').value, '33');
  p.click('[name="range-to-down"]');
  p.click('[name="range-to-down"]');
  p.click('[name="range-from-up"]');
  assert.ok(p.text().includes('30 choices: 2 to 31'));
  assert.ok(p.$('.savebar').textContent.includes('3 removed'));
  const to = p.$('[name="range-to"]');
  to.value = '40';
  p.fire(to, 'change');
  assert.ok(
    p.text().includes('39 choices: 2 to 40'),
    'the number can also be typed'
  );
  p.click('[name="save-list"]');
  await settle(8);
  const saved = w
    .admin({ action: 'admin.lists.get' })
    .lists.wa_sections.map((o) => o.value);
  assert.deepEqual(
    [saved[0], saved[saved.length - 1], saved.length],
    ['2', '40', 39]
  );
});

test(
  'Lists: a new list of sections, picked for the section question of ' +
    'one form, limits that form',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, '#/lists');
    p.click('[name="new-list"]');
    await settle(2);
    assert.equal(p.win.location.hash, '#/lists/new');
    assert.equal(
      p.$('[name="create-list"]'),
      null,
      'nothing to make before it has a name'
    );
    p.type('[name="list-name"]', 'Sections');
    p.click('[name="copy-none"]');
    p.click('[name="create-list"]');
    await settle(8);
    assert.ok(
      p.text().includes('Another list has that name.'),
      'the reason is next to the name'
    );
    assert.equal(p.$('[name="list-name"]').value, 'Sections');
    p.type('[name="list-name"]', 'Third year');
    p.click('[name="create-list"]');
    await settle(8);
    assert.equal(p.win.location.hash, '#/lists/third_year');
    assert.ok(
      p.$('[name="delete-list"]'),
      'a list no form asks can be deleted'
    );
    assert.ok(
      p.$('[name="add-group-open"]').classList.contains('btn-primary'),
      'an empty list leads with Add a year group'
    );
    p.click('[name="add-group-open"]');
    p.click('[name="group-year-3"]');
    p.click('[name="group-letter-add"]');
    p.type('[name="group-letter-new"]', 'L');
    p.click('[name="draft-count-TH-up"]');
    p.type('[name="draft-count-T"]', '2');
    p.click('[name="add-group"]');
    p.click('[name="save-list"]');
    await settle(8);
    assert.deepEqual(
      w
        .admin({ action: 'admin.lists.get' })
        .lists.third_year.map((o) => o.value),
      ['3L-TH1', '3L-T1', '3L-T2']
    );

    const q = await openAdmin(w, `#/f/${f.slug}/questions`);
    assert.equal(
      q.$('[name="list-level"]'),
      null,
      'a question with no other list to read offers no choice'
    );
    const pick = q.$('[name="list-section"]');
    pick.value = 'third_year';
    q.fire(pick, 'change');
    q.click(`[href="#/f/${f.slug}/settings"]`);
    await settle(4);
    assert.ok(
      q.$('[name="section-3L-T2"]'),
      'Who can register offers the sections of the list now read'
    );
    q.click('[name="section-3L-T1"]');
    q.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(
      saved.fields.find((x) => x.id === 'section').list,
      'third_year'
    );
    assert.equal(
      saved.fields
        .find((x) => x.role === 'members')
        .fields.find((x) => x.id === 'section').list,
      'third_year',
      'the members follow the leader'
    );
    const offered = w
      .api({ action: 'getForm', slug: f.slug })
      .form.fields.find((x) => x.id === 'section')
      .options.map((o) => o.value);
    assert.deepEqual(
      offered,
      ['3L-T1'],
      'students are offered the picked sections of the new list'
    );

    const r = await openAdmin(w, '#/lists/third_year');
    assert.equal(
      r.$('[name="delete-list"]'),
      null,
      'no Delete while a form asks the list'
    );
    assert.equal(
      w.admin({ action: 'admin.lists.delete', key: 'third_year' }).error.code,
      'list_in_use'
    );
    assert.equal(
      w.admin({ action: 'admin.lists.delete', key: 'sections' }).error.code,
      'list_builtin'
    );
    r.click('[name="rename-list"]');
    r.type('[name="rename-input"]', 'Year 3 sections');
    r.click('[name="rename-save"]');
    await settle(6);
    assert.ok(r.$('.list-title h2').textContent.includes('Year 3 sections'));
  }
);

test(
  'Lists: the server refuses a list that does not exist and a question ' +
    'that reads one',
  () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    assert.equal(
      w.admin({ action: 'admin.lists.set', key: 'nope', values: ['A'] }).error
        .code,
      'list_not_found'
    );
    assert.equal(
      w.admin({ action: 'admin.lists.set', key: '_info', values: ['A'] }).error
        .code,
      'list_not_found',
      'the info row is not a list'
    );
    const fields = w
      .admin({ action: 'admin.forms.get', id: f.id })
      .form.fields.map((x) =>
        x.id === 'section' ? { ...x, list: 'nope' } : x
      );
    assert.equal(
      w.admin({ action: 'admin.forms.update', id: f.id, patch: { fields } })
        .error.code,
      'list_not_found'
    );
    assert.equal(
      Object.keys(w.admin({ action: 'admin.lists.get' }).lists).includes(
        '_info'
      ),
      false
    );
  }
);

test(
  'Lists: a list of milestones is named rows with hidden ids that stay ' +
    'when a milestone is renamed or moved',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '#/lists');
    p.click('[name="new-list"]');
    await settle(2);
    p.type('[name="list-name"]', 'Project milestones');
    p.click('[name="kind-milestones"]');
    p.click('[name="create-list"]');
    await settle(8);
    assert.equal(p.win.location.hash, '#/lists/project_milestones');
    assert.ok(p.text().includes('A form copies these milestones'));
    assert.equal(p.$('[name="new-en"]'), null, 'a milestone is its name');
    for (const name of ['Task 1', 'Task 2']) {
      p.type('[name="new-value"]', name);
      p.click('[name="add-choice"]');
    }
    assert.equal(p.$('[name="value-0"]'), null, 'the id is never shown');
    assert.ok(p.$('[name="ar-0"]'), 'a milestone has an Arabic name');
    p.type('[name="ar-1"]', 'المهمة 2');
    p.click('[name="save-list"]');
    await settle(8);
    const saved = () =>
      w.admin({ action: 'admin.lists.get' }).lists.project_milestones;
    const first = saved();
    assert.deepEqual(
      first.map((o) => [o.label.en, o.label.ar]),
      [
        ['Task 1', 'Task 1'],
        ['Task 2', 'المهمة 2']
      ],
      'a missing Arabic name repeats the English one, not the id'
    );
    assert.ok(first.every((o) => /^m_[a-z0-9]+$/.test(o.value)));
    assert.notEqual(first[0].value, first[1].value);

    p.type('[name="en-0"]', 'Proposal');
    p.click('.choice[data-i="1"] [aria-label="Move up"]');
    p.type('[name="en-1"]', '');
    p.click('[name="save-list"]');
    await settle(4);
    assert.ok(
      p.text().includes('Milestone 2 has no English name.'),
      'a milestone with no name is refused'
    );
    assert.equal(p.$('[name="ar-1"]').value, '', 'the row stays as typed');
    p.type('[name="en-1"]', 'Proposal');
    p.click('[name="save-list"]');
    await settle(8);
    assert.deepEqual(
      saved().map((o) => [o.value, o.label.en]),
      [
        [first[1].value, 'Task 2'],
        [first[0].value, 'Proposal']
      ],
      'renamed and moved, each keeps its id'
    );

    const paste = p.$('[name="paste-list"]');
    paste.value = 'Task 3 | المهمة 3\nTask 4';
    p.fire(paste, 'input');
    p.click('[name="paste-add"]');
    assert.equal(p.$('[name="en-2"]').value, 'Task 3');
    assert.equal(p.$('[name="ar-2"]').value, 'المهمة 3');
    p.click('[name="remove-3"]');
    p.click('[name="remove-2"]');
    assert.ok(p.$('.savebar').hidden, 'back to the saved milestones');
  }
);
