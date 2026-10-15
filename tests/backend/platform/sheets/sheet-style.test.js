const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../harness/appsscript-mock.js');

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
  // The views are painted by the run a change books, so reading one lets that
  // run happen first.
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

test(
  'Data tabs: the registry and a new form get the header, the widths ' +
    'and the row tints',
  () => {
    const w = boot('team_registration');
    const tinted = (cols) => ({
      head: true,
      frozen: 1,
      bands: [[1000, cols, INK, '#FFFFFF', '#F8F1DE']]
    });
    assert.deepEqual(looks(w.registry.getSheetByName('Forms'), 13), tinted(13));
    assert.deepEqual(
      looks(w.registry.getSheetByName('Clients'), 13),
      tinted(13)
    );
    assert.deepEqual(looks(w.registry.getSheetByName('Lists'), 2), tinted(2));
    const responses = w.sheet(w.form.sheetId, 'Responses');
    assert.deepEqual(looks(responses, 21), tinted(21));
    assert.equal(responses.widths.get(8), 240, 'the name column is wide');
    assert.equal(responses.widths.get(20), 80, 'the number column is narrow');
    assert.deepEqual(
      responses.rows()[0].slice(0, 3),
      ['id', 'ref', 'created'],
      'the header still holds the column names'
    );
  }
);

test(
  'Data tabs: a sheet made before the look existed gets it on the next ' +
    'repaint, and no value changes',
  () => {
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
    assert.equal(looks(responses, 21).head, true);
    assert.deepEqual(
      looks(requests, 7),
      { head: true, frozen: 1, bands: [[1000, 7, INK, '#FFFFFF', '#F8F1DE']] },
      'a tab only some forms have is dressed too'
    );
    assert.equal(
      JSON.stringify([
        responses.rows(),
        requests.rows(),
        [...responses.formats]
      ]),
      before,
      'values and number formats are untouched'
    );

    const band = responses.bandings[0];
    w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
    assert.equal(responses.bandings[0], band, 'a dressed tab is left alone');
    responses.backgrounds.delete('1,21');
    w.admin({ action: 'admin.views.rebuild', slug: w.form.slug });
    assert.deepEqual(
      [
        responses.bandings.length,
        responses.bandings[0] === band,
        looks(responses, 21).head
      ],
      [1, false, true],
      'a column added later is dressed with the rest'
    );
  }
);

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
