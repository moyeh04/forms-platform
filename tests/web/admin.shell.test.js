const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('../harness/dom.js');
const { boot, openAdmin } = require('../harness/admin-page.js');

test(
  'Login: a wrong PIN is refused ' + 'and the right one opens the dashboard',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '', false);
    assert.ok(p.$('#pin'));
    p.type('#pin', '0000');
    p.submitForm();
    await settle(8);
    assert.ok(p.$('#pin-err').textContent.includes('not correct'));
    assert.equal(
      p.$('#pin').value,
      '0000',
      'the refused PIN stays in its field'
    );
    assert.deepEqual(
      [p.$('#pin').selectionStart, p.$('#pin').selectionEnd],
      [0, 4],
      'selected, so typing replaces it'
    );
    p.type('#pin', '4321');
    p.submitForm();
    await settle(10);
    assert.ok(p.text().includes('No forms yet'));
    assert.equal(p.$('.admin-nav a[aria-current="page"]').textContent, 'Forms');
  }
);

test(
  'Login: a lock after wrong tries elsewhere does not sign an open ' +
    'dashboard out',
  async () => {
    const w = boot();
    w.make('team_registration', 'Projects');
    for (let i = 0; i < 8; i++)
      w.api({ action: 'admin.login', admin: { pin: '0000' } });
    const p = await openAdmin(w);
    assert.ok(
      p.$('.banner').textContent.includes('Too many wrong PINs'),
      'the page says to wait'
    );
    assert.equal(p.$('#pin'), null, 'and does not ask for the PIN again');
    assert.equal(p.win.App.api.getPin(), '4321');
    w.call('unlockAdmin');
    await p.win.App.admin.start();
    await settle(10);
    assert.ok(
      p.text().includes('Projects'),
      'the same window works once the lock is lifted'
    );
  }
);

test(
  'Forms: the list shows every form ' + 'with its type, status, and actions',
  async () => {
    const w = boot();
    w.make('team_registration', 'Projects');
    w.make('reservation', 'Seminar', { status: 'closed' });
    const p = await openAdmin(w);
    const cards = p.$$('.card');
    assert.equal(cards.length, 2);
    assert.ok(
      p.text().includes('Team registration') && p.text().includes('Reservation')
    );
    assert.ok(p.$$('.badge').some((b) => b.textContent === 'Closed'));
    assert.ok(cards[0].querySelector('a[href*="index.html?f="]'));
  }
);

test(
  'Create: pick a type, name it, and ' + 'land on its settings as a draft',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '#/new');
    p.pick('type', 'task_submission');
    p.type('[name="title"]', 'Database Tasks');
    p.click('[name="season-spring"]');
    const year = p.$('[name="termYear"]');
    year.value =
      new Date().getFullYear() + 1 + '/' + (new Date().getFullYear() + 2);
    p.fire(year, 'change');
    p.type('[name="subject"]', 'CMP n323');
    p.submitForm();
    await settle(12);
    const forms = w.admin({ action: 'admin.forms.list' }).forms;
    assert.equal(forms.length, 1);
    assert.equal(forms[0].type, 'task_submission');
    assert.equal(
      forms[0].term,
      'Spring ' +
        (new Date().getFullYear() + 1) +
        '/' +
        (new Date().getFullYear() + 2),
      'season chip plus academic year'
    );
    assert.equal(
      forms[0].subject,
      'CMPn323',
      'spaces are removed from the subject code'
    );
    assert.equal(forms[0].status, 'draft');
    assert.ok(p.win.location.hash.endsWith('/settings'));
    assert.ok(p.$('[name="teamMin"]'), 'settings page is showing');
  }
);

test(
  'Create: switching types replaces subject and term metadata with a ' +
    'batch year',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '#/new');
    p.pick('type', 'task_submission');
    p.type('[name="subject"]', 'CMPn323');
    p.click('[name="season-spring"]');
    const termYear = p.$('[name="termYear"]');
    termYear.value = '2028/2029';
    p.fire(termYear, 'change');

    p.pick('type', 'whatsapp_registration');
    assert.equal(
      p.$('[name="subject"]'),
      null,
      'WhatsApp registration does not ask for a subject code'
    );
    assert.equal(
      p.$('[name="termYear"]'),
      null,
      'WhatsApp registration does not ask for a semester'
    );
    assert.equal(
      p.$('[name="batchYear"]').value,
      new Date().getFullYear() + '/' + (new Date().getFullYear() + 1)
    );
    p.pick('batchYear', '2030/2031');

    p.pick('type', 'task_submission');
    assert.equal(
      p.$('[name="subject"]').value,
      'CMPn323',
      'switching back restores subject metadata'
    );
    assert.equal(
      p.$('[name="termYear"]').value,
      '2028/2029',
      'switching back restores term metadata'
    );
    p.pick('type', 'whatsapp_registration');
    assert.equal(
      p.$('[name="batchYear"]').value,
      '2030/2031',
      'switching types preserves the batch year'
    );

    p.type('[name="title"]', 'Groups 2029');
    p.submitForm();
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.list' }).forms[0];
    assert.equal(saved.type, 'whatsapp_registration');
    assert.equal(saved.batchYear, '2030/2031');
    assert.equal(
      JSON.parse(w.registry.getSheetByName('Forms').rows()[1][10]).batchYear,
      '2030/2031'
    );
    assert.equal(
      saved.term,
      '',
      'new WhatsApp forms do not persist a semester'
    );
    assert.equal(
      saved.subject,
      undefined,
      'new WhatsApp forms do not persist a subject code'
    );
  }
);

test(
  'WhatsApp metadata: settings, public form, and viewer retain and ' +
    'display batch year',
  async () => {
    const w = boot();
    const f = w.admin({
      action: 'admin.forms.create',
      type: 'whatsapp_registration',
      title: 'Groups 2028',
      batchYear: '2028/2029'
    }).form;
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open' }
    });
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(p.$('[name="batchYear"]').value, '2028/2029');
    assert.equal(p.$('[name="termYear"]'), null);
    assert.equal(p.$('[name="subject"]'), null);
    p.type('[name="batchYear"]', '2029/2030');
    p.click('[name="save"]');
    await settle(12);

    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(saved.batchYear, '2029/2030');
    assert.equal(saved.term, '');
    const settingsReload = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(settingsReload.$('[name="batchYear"]').value, '2029/2030');
    assert.ok(settingsReload.text().includes('Batch 2029/2030'));
    assert.equal(settingsReload.text().includes('Fall 2027'), false);

    const pub = w.api({ action: 'getForm', slug: f.slug }).form;
    assert.equal(pub.batchYear, '2029/2030');
    assert.equal(
      pub.term,
      undefined,
      'public WhatsApp metadata contains only the batch year'
    );
    const studentPage = await openPage('index.html', w, {
      query: `?f=${f.slug}`
    });
    studentPage.window.App.form.init();
    await settle();
    assert.equal(
      studentPage.window.document.querySelector('.tags').textContent.trim(),
      'Batch 2029/2030'
    );
    assert.equal(
      studentPage.window.document.title,
      'Groups 2028 - Batch 2029/2030'
    );

    const client = w.admin({
      action: 'admin.clients.create',
      name: 'Dr. Ahmed',
      forms: [f.slug],
      withKey: false
    });
    const viewerMe = w.api({ action: 'viewer.me', token: client.token });
    assert.equal(viewerMe.forms[0].batchYear, '2029/2030');
    assert.equal(viewerMe.forms[0].term, undefined);
    const viewer = w.api({
      action: 'viewer.data',
      token: client.token,
      slug: f.slug
    });
    assert.equal(viewer.form.batchYear, '2029/2030');
    assert.equal(viewer.form.term, undefined);
    const viewerPage = await openPage('viewer.html', w, {
      query: `?t=${client.token}`
    });
    await viewerPage.window.App.viewer.start();
    await settle(8);
    assert.equal(
      viewerPage.window.document
        .querySelector('.admin-bar')
        .textContent.includes('Batch 2029/2030'),
      true
    );
    assert.equal(
      viewerPage.window.document
        .querySelector('.admin-bar')
        .textContent.includes('Fall 2027'),
      false
    );

    const cardPage = await openAdmin(w);
    const card = cardPage.$('.card[data-slug="' + f.slug + '"]');
    assert.deepEqual(
      [...card.querySelectorAll('.card-tags .tag-sm')].map(
        (tag) => tag.textContent
      ),
      ['Batch 2029/2030']
    );
    const responsesPage = await openAdmin(w, `#/f/${f.slug}`);
    assert.deepEqual(
      [...responsesPage.$$('.page-head .tag-sm')].map((tag) => tag.textContent),
      ['Batch 2029/2030']
    );
  }
);

test(
  'WhatsApp metadata: legacy semester records resolve to batch year ' +
    'without displaying old subject metadata',
  async () => {
    const w = boot();
    const f = w.admin({
      action: 'admin.forms.create',
      type: 'whatsapp_registration',
      title: 'Legacy Groups',
      term: 'Fall 2027',
      subject: 'CMPn123'
    }).form;
    const forms = w.registry.getSheetByName('Forms');
    const row = forms.rows()[1];
    const config = JSON.parse(row[10]);
    delete config.batchYear;
    config.subject = 'CMPn123';
    forms.getRange(2, 11).setValue(JSON.stringify(config));
    forms.getRange(2, 5).setValue('Fall 2027');

    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(
      saved.batchYear,
      '2027/2028',
      'legacy storage is resolved through its metadata adapter'
    );
    assert.equal(
      JSON.parse(forms.rows()[1][10]).batchYear,
      undefined,
      'the legacy record remains unmodified before save'
    );
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(p.$('[name="batchYear"]').value, '2027/2028');
    assert.equal(p.$('[name="subject"]'), null);
    assert.ok(p.text().includes('Batch 2027/2028'));
    assert.equal(p.text().includes('CMPn123'), false);

    p.click('[name="save"]');
    await settle(12);
    const migrated = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(migrated.batchYear, '2027/2028');
    assert.equal(
      migrated.term,
      'Fall 2027',
      'saving does not destroy the legacy value'
    );
    const publicForm = w.api({ action: 'getForm', slug: f.slug }).form;
    assert.equal(publicForm.batchYear, '2027/2028');
    assert.equal(publicForm.subject, undefined);
    assert.equal(publicForm.term, undefined);
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open' }
    });
    const client = w.admin({
      action: 'admin.clients.create',
      name: 'Dr. Ahmed',
      forms: [f.slug],
      withKey: false
    });
    const view = w.api({
      action: 'viewer.data',
      token: client.token,
      slug: f.slug
    });
    assert.equal(view.form.batchYear, '2027/2028');
    assert.equal(view.form.subject, undefined);
    assert.equal(view.form.term, undefined);
  }
);

test('Create: a title is required', async () => {
  const w = boot();
  const p = await openAdmin(w, '#/new');
  assert.ok(p.$('#new-title-err').hidden);
  p.submitForm();
  await settle(4);
  assert.equal(
    p.$('#new-title-err').hidden,
    false,
    'the reason is next to the field'
  );
  assert.equal(
    p.$('#new-title-err').textContent,
    'Give the form a title first.'
  );
  assert.equal(p.$('[name="title"]').getAttribute('aria-invalid'), 'true');
  assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 0);
  p.type('[name="title"]', 'Seminar');
  assert.ok(
    p.$('#new-title-err').hidden,
    'the reason leaves when the title is typed'
  );
});

test(
  'Create: the preview shows the title, the tags and the pages of the ' +
    'chosen kind of form',
  async () => {
    const w = boot();
    const p = await openAdmin(w, '#/new');
    assert.equal(p.$('.new-preview-title').textContent, 'Your title');
    p.type('[name="title"]', 'Project discussion');
    p.type('[name="subject"]', 'CS101');
    assert.equal(p.$('.new-preview-title').textContent, 'Project discussion');
    assert.ok(p.$('.new-preview').textContent.includes('CS101'));
    for (const type of Object.keys(p.win.App.admin.TYPES)) {
      p.pick('type', type);
      const made = w.admin({
        action: 'admin.forms.create',
        type,
        title: 'T ' + type,
        term: 'Fall 2027'
      }).form;
      assert.deepEqual(
        p.$$('.new-pages li').map((n) => n.textContent),
        made.steps.map((st) => st.title.en).concat(['Review']),
        type + ': the preview lists the pages of the template'
      );
    }
  }
);

test(
  'Term: settings show the saved season and year, and switching season ' +
    'saves the new term',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(
      p.$('[name="season-fall"]').getAttribute('aria-pressed'),
      'true'
    );
    assert.equal(p.$('[name="termYear"]').value, '2027/2028');
    p.click('[name="season-summer"]');
    p.type('[name="subject"]', 'CMPn336');
    p.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(saved.term, 'Summer 2027/2028');
    assert.equal(saved.subject, 'CMPn336');
    const pub = w.api({ action: 'getForm', slug: saved.slug }).form;
    assert.equal(pub.subject, 'CMPn336', 'students get the subject code');
  }
);

test(
  'Delete form: one confirmation from the card removes it; cancelling ' +
    'keeps it',
  async () => {
    const w = boot();
    w.make('team_registration', 'Old projects');
    const p = await openAdmin(w);
    p.click('[name="delete-form"]');
    await settle(2);
    assert.ok(p.text().includes('Delete "Old projects"?'));
    p.clickText('Keep it');
    await settle(4);
    assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 1);
    p.click('[name="delete-form"]');
    await settle(2);
    p.click('.overlay .btn-danger');
    await settle(12);
    assert.equal(w.admin({ action: 'admin.forms.list' }).forms.length, 0);
    assert.ok(p.text().includes('No forms yet'));
  }
);

test(
  'Form tabs: questions, timetable and setup are tabs of one page, and ' +
    'a change in one tab stays when another opens',
  async () => {
    const w = boot();
    const f = w.admin({
      action: 'admin.forms.create',
      type: 'reservation',
      title: 'Seminar',
      term: 'Fall 2027'
    }).form;
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.deepEqual(
      p.$$('.form-tabs a').map((a) => a.textContent.replace('!', '')),
      ['Responses', 'Questions', 'Timetable', 'Setup']
    );
    assert.equal(
      p.$('[name="tab-settings"]').getAttribute('aria-current'),
      'page'
    );
    assert.ok(
      p.$('[name="tab-timetable"] .tab-alert'),
      'a timetable with no days asks for attention'
    );
    assert.ok(
      p.$('[data-panel="Timetable"]').hidden &&
        !p.$('[data-panel="Edit key"]').hidden
    );

    p.type('[name="keyDays"]', '9');
    p.click('[name="tab-timetable"]');
    assert.equal(p.win.location.hash, `#/f/${f.slug}/timetable`);
    assert.ok(
      !p.$('[data-panel="Timetable"]').hidden &&
        p.$('[data-panel="Edit key"]').hidden
    );
    assert.equal(
      p.$('[name="keyDays"]').value,
      '9',
      'the page was not drawn again'
    );
    p.click('[name="capacity-up"]');
    p.click('[name="capacity-up"]');
    p.click('[name="capacity-down"]');
    p.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(saved.editKey.days, 9);
    assert.equal(saved.slots.capacity, 2);

    const team = w.admin({
      action: 'admin.forms.create',
      type: 'team_registration',
      title: 'Teams',
      term: 'Fall 2027'
    }).form;
    const q = await openAdmin(w, `#/f/${team.slug}/questions`);
    assert.equal(
      q.$('[name="tab-timetable"]'),
      null,
      'only a reservation has a timetable'
    );
    assert.deepEqual(
      q.$$('.q-page [name^="page-title-en-"]').map((n) => n.value),
      ['About you', 'Study details', 'Team members', 'Project']
    );
    const responses = await openAdmin(w, `#/f/${team.slug}`);
    assert.equal(
      responses.$('[name="tab-responses"]').getAttribute('aria-current'),
      'page'
    );
  }
);

test(
  'Form header: the same on every tab, and the status is saved where ' +
    'it is changed',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const actions = (p) =>
      p
        .$$(
          '.page-head > a, .page-head > button, .page-head summary, .page-head [role="menuitem"]'
        )
        .map((n) => n.textContent);
    const responses = await openAdmin(w, `#/f/${f.slug}`);
    const setup = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.deepEqual(actions(responses), [
      'Open form',
      'Copy link',
      'More',
      'Open Google Sheet',
      'Rebuild sheet',
      'Duplicate for a new term',
      'Delete form'
    ]);
    assert.deepEqual(actions(setup), actions(responses));
    assert.equal(
      responses.$('.toolbar [name="rebuild"]'),
      null,
      'Rebuild sheet is under More, not among the tools'
    );
    responses.click('[name="rebuild"]');
    await settle(8);
    assert.ok(responses.text().includes('Google Sheet views rebuilt'));

    assert.equal(responses.$('[name="status"]').value, 'open');
    w.advanceDays(0.001);
    responses.pick('status', 'closed');
    await settle(8);
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.status,
      'closed',
      'no Save is needed on Responses'
    );
    assert.ok(responses.text().includes('Status saved: Closed'));

    // On Setup the status is not one of the unsaved changes, and a later Save still passes.
    setup.pick('status', 'draft');
    await settle(8);
    assert.ok(
      setup.$('.head-note').textContent.includes('The status is still Open.'),
      'a copy that is out of date is refused, with the reason'
    );
    assert.equal(
      setup.$('[name="status"]').value,
      'open',
      'and the saved status is back in the control'
    );
    const fresh = await openAdmin(w, `#/f/${f.slug}/settings`);
    w.advanceDays(0.001);
    fresh.pick('status', 'open');
    await settle(8);
    assert.ok(fresh.$('.savebar').hidden, 'nothing waits for Save');
    fresh.type('[name="title"]', 'Projects 2');
    fresh.click('[name="save"]');
    await settle(12);
    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.deepEqual([saved.status, saved.title], ['open', 'Projects 2']);
  }
);

test(
  'Forms list: grouped by status, a reservation with no days says so, ' +
    'and a first booking is offered only where teams are',
  async () => {
    const w = boot();
    const teams = w.make('team_registration', 'Projects');
    const chat = w.make('whatsapp_registration', 'Groups');
    const seminar = w.make('reservation', 'Seminar', {
      slots: { days: [], capacity: 1 }
    });
    const draft = w.admin({
      action: 'admin.forms.create',
      type: 'task_submission',
      title: 'Tasks',
      term: 'Fall 2027'
    }).form;
    const p = await openAdmin(w);
    assert.deepEqual(
      p
        .$$('.form-group')
        .map((g) => [
          g.dataset.status,
          g.querySelector('.group-title').textContent
        ]),
      [
        ['open', 'Open3'],
        ['draft', 'Draft1']
      ]
    );
    const card = (f) => p.$(`.card[data-slug="${f.slug}"]`);
    assert.ok(card(draft).closest('[data-status="draft"]'));
    assert.ok(
      card(seminar)
        .querySelector('[name="no-days"]')
        .getAttribute('href')
        .endsWith('/timetable'),
      'the note leads to where days are added'
    );
    assert.ok(card(teams).querySelector('[name="next-booking"]'));
    assert.equal(
      card(chat).querySelector('[name="next-booking"]'),
      null,
      'a form of single students is not offered a booking'
    );
    assert.equal(card(seminar).querySelector('[name="next-booking"]'), null);
    assert.deepEqual(
      [...card(teams).querySelectorAll('.card-actions > a')].map(
        (a) => a.textContent
      ),
      ['Responses', 'Setup', 'Open form'],
      'the card names the tab as the tab does'
    );
  }
);
