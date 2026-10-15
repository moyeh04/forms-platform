const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  return w;
}

test('Lists: admins can replace a list and options follow', () => {
  const w = boot();
  w.admin({ action: 'admin.lists.set', key: 'sections', values: ['S1', 'S2'] });
  const f = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'T',
    term: ''
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { status: 'open' }
  });
  const sec = w
    .api({ action: 'getForm', slug: f.slug })
    .form.fields.find((x) => x.id === 'section');
  assert.deepEqual(
    sec.options.map((o) => o.value),
    ['S1', 'S2']
  );
});
