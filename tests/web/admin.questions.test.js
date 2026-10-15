const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, settle } = require('../harness/dom.js');
const { boot, openAdmin, person } = require('../harness/admin-page.js');

test(
  'Questions: an admin adds a description and students read it under ' +
    'the question',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.ok(
      p.$('[data-desc="link"]').hidden,
      'no description yet, so its editor is folded away'
    );
    p.click('[name="desc-link"]');
    assert.equal(p.$('[data-desc="link"]').hidden, false);
    p.type(
      '[name="help-en-link"]',
      'Name it Name_Project_Name_Subject and share it with anyone'
    );
    p.type('[name="help-ar-link"]', 'اعمل شير للفولدر');
    p.click('[name="save"]');
    await settle(12);
    const link = w
      .api({ action: 'getForm', slug: f.slug })
      .form.fields.find((x) => x.id === 'link');
    assert.deepEqual(link.help, {
      en: 'Name it Name_Project_Name_Subject and share it with anyone',
      ar: 'اعمل شير للفولدر'
    });
  }
);

test(
  'Questions: the admin adds a question to a page, students answer it, ' +
    'and a question moves to another page',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/questions`);
    p.click('[name="add-question-project"]');
    const id = p.$('.q-row.custom').dataset.field;
    p.click('[name="save"]');
    await settle(8);
    assert.equal(
      w
        .admin({ action: 'admin.forms.get', id: f.id })
        .form.fields.some((x) => x.custom),
      false,
      'a question with no text is not saved'
    );

    p.type(`[aria-label="English label for ${id}"]`, 'T-shirt size');
    p.pick(`kind-${id}`, 'select');
    p.click('[name="save"]');
    await settle(8);
    assert.equal(
      w
        .admin({ action: 'admin.forms.get', id: f.id })
        .form.fields.some((x) => x.custom),
      false,
      'a choice question needs its choices'
    );
    p.type(`[name="choices-${id}"]`, 'Small | صغير\nLarge');
    p.click('[name="page-email"]');
    p.pick('page-email', 'project');
    p.click('[name="save"]');
    await settle(12);

    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    const added = saved.fields.find((x) => x.custom);
    assert.deepEqual(JSON.parse(JSON.stringify(added.options)), [
      { value: 'Small', label: { en: 'Small', ar: 'صغير' } },
      { value: 'Large', label: { en: 'Large', ar: 'Large' } }
    ]);
    const project = saved.steps.find((st) => st.id === 'project').fields;
    assert.deepEqual(
      project.slice(-2),
      [id, 'email'],
      'the new question and the moved one are on the Project page'
    );
    assert.equal(saved.steps[0].fields.includes('email'), false);

    const data = {
      ...person({ title: 'Library' }),
      team_size: '1',
      members: []
    };
    assert.equal(
      w.api({ action: 'submit', slug: f.slug, data: { ...data, [id]: 'Huge' } })
        .error.details[id].error,
      'invalid_choice'
    );
    const sent = w.api({
      action: 'submit',
      slug: f.slug,
      data: { ...data, [id]: 'Large' }
    });
    assert.equal(sent.ok, true);
    const responses = await openAdmin(w, `#/f/${f.slug}`);
    responses.click('[name="details"]');
    await settle();
    assert.ok(
      responses.text().includes('T-shirt size') &&
        responses.text().includes('Large'),
      'the answer is in the details of the registration'
    );

    const again = await openAdmin(w, `#/f/${f.slug}/questions`);
    again.click(`[name="remove-${id}"]`);
    again.click('[name="save"]');
    await settle(12);
    const after = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.equal(
      after.fields.some((x) => x.custom),
      false
    );
    assert.equal(
      after.steps.find((st) => st.id === 'project').fields.includes(id),
      false
    );
  }
);

test(
  'Pages: the admin adds a page with its title, puts a question on it, ' +
    'renames and reorders pages',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, `#/f/${f.slug}/questions`);
    p.click('[name="add-page"]');
    const page = p.$$('.q-page').pop().dataset.page;
    assert.ok(
      p.text().includes('Students do not see a page with no questions.')
    );
    p.click('[name="save"]');
    await settle(8);
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.steps.length,
      4,
      'a page with no title is not saved'
    );

    p.type(`[name="page-title-en-${page}"]`, 'Extras');
    p.type(`[name="page-title-ar-${page}"]`, 'إضافات');
    p.click(`[name="add-question-${page}"]`);
    const id = p.$('.q-row.custom').dataset.field;
    p.type(`[aria-label="English label for ${id}"]`, 'Anything else?');
    p.type('[name="page-title-en-you"]', 'Leader');
    p.click(`[name="page-up-${page}"]`);
    assert.equal(
      p.$(`[name="remove-page-${page}"]`),
      null,
      'a page with a question on it cannot be removed'
    );
    p.click('[name="save"]');
    await settle(12);

    const saved = w.admin({ action: 'admin.forms.get', id: f.id }).form;
    assert.deepEqual(
      saved.steps.map((st) => st.title.en),
      ['Leader', 'Study details', 'Team members', 'Extras', 'Project']
    );
    assert.deepEqual(JSON.parse(JSON.stringify(saved.steps[3])).fields, [id]);
    assert.equal(saved.steps[3].title.ar, 'إضافات');

    const student = await openPage('index.html', w, { query: `?f=${f.slug}` });
    student.window.App.form.init();
    await settle();
    const trail = [
      ...student.window.document.querySelectorAll('.trail-label')
    ].map((n) => n.textContent);
    assert.deepEqual(trail.slice(0, 5), [
      'Leader',
      'Study details',
      'Team members',
      'Extras',
      'Project'
    ]);

    const again = await openAdmin(w, `#/f/${f.slug}/questions`);
    again.click(`[name="remove-${id}"]`);
    again.click(`[name="remove-page-${page}"]`);
    again.click('[name="save"]');
    await settle(12);
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.steps.length,
      4
    );
  }
);
