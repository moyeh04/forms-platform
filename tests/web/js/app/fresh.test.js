/**
 * A page that is older than the published site: it reloads itself when nothing would be lost,
 * and offers a Reload button when something would.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../harness/appsscript-mock.js');
const { openPage, helpers, settle } = require('../../../harness/dom.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const f = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Projects',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { status: 'open' }
  });
  w.slug = f.slug;
  return w;
}

/** Opens a page and puts the published version and the reload in the hands of the test. */
async function open(t, file, w, options) {
  const dom = await openPage(file, w, options);
  t.after(() => dom.window.close());
  const site = { version: 'v1', reloads: 0 };
  dom.window.App.fresh.read = async () => site.version;
  dom.window.App.fresh.reload = () => {
    site.reloads++;
  };
  return {
    dom,
    win: dom.window,
    site,
    fresh: dom.window.App.fresh,
    ...helpers(dom.window)
  };
}

test(
  'Fresh page: an untouched page reloads once for a newer site, then ' +
    'offers the button instead of a loop',
  async (t) => {
    const p = await open(t, 'viewer.html', boot(), { query: '?t=none' });
    p.site.version = 'v2';
    await p.fresh.start('v1');
    assert.equal(
      p.site.reloads,
      1,
      'an older page that nobody touched reloads itself'
    );
    assert.equal(p.$('.fresh-bar'), null);

    // The browser gave the old page again: the same tab does not reload a second time for that version.
    await p.fresh.check(true);
    assert.equal(p.site.reloads, 1);
    assert.equal(p.$('.fresh-bar').getAttribute('role'), 'status');
    assert.equal(
      p.$('.fresh-bar span').textContent,
      'A newer version of this page is ready.'
    );
    p.click('[name="fresh-reload"]');
    assert.equal(p.site.reloads, 2, 'the button reloads when the visitor asks');
    assert.equal(p.win.sessionStorage.getItem('fp_fresh_tried'), 'v2');

    p.site.version = 'v3';
    await p.fresh.check(true);
    assert.equal(
      p.site.reloads,
      3,
      'a later version is a new reason to reload'
    );
    p.site.version = 'v1';
    await p.fresh.check(true);
    assert.equal(
      p.$('.fresh-bar'),
      null,
      'and the bar goes once the page is the published one'
    );
  }
);

test(
  'Fresh page: a page somebody is typing in is never reloaded, and the ' +
    'bar speaks the language of the form',
  async (t) => {
    const w = boot();
    const p = await open(t, 'index.html', w, {
      query: `?f=${w.slug}`,
      lang: 'ar'
    });
    p.win.App.form.init();
    await settle();
    await p.fresh.start('v1');
    assert.equal(p.site.reloads, 0, 'the page is the published one');
    p.type('[name="email"]', 'a@b.com');
    p.site.version = 'v2';
    await p.fresh.check(true);
    assert.equal(p.site.reloads, 0, 'what was typed is not thrown away');
    assert.equal(
      p.$('.fresh-bar span').textContent,
      'فيه نسخة أحدث من الصفحة دي.'
    );
    assert.equal(p.$('[name="fresh-reload"]').textContent, 'حمّل الصفحة تاني');
    assert.equal(p.$('[name="email"]').value, 'a@b.com');
    await p.fresh.check(true);
    assert.equal(
      p.$$('.fresh-bar').length,
      1,
      'one bar, however many times the page checks'
    );
    p.win.App.i18n.set('en');
    await settle();
    assert.equal(
      p.$('.fresh-bar span').textContent,
      'A newer version of this page is ready.',
      'the bar follows the language of the page'
    );
  }
);

test('Fresh page: an open dialog is not closed by a reload', async (t) => {
  const w = boot();
  const p = await open(t, 'admin.html', w);
  p.win.App.api.setPin('4321');
  await p.win.App.admin.start();
  await settle(10);
  await p.fresh.start('v1');
  p.win.App.ui.confirm({
    title: 'Delete this form?',
    body: 'It leaves the dashboard.'
  });
  p.site.version = 'v2';
  await p.fresh.check(true);
  assert.ok(p.$('.overlay'), 'the dialog is still open');
  assert.equal(p.site.reloads, 0);
  assert.ok(p.$('[name="fresh-reload"]'));
});

test(
  'Fresh page: a preview has no version and a site that cannot be read ' +
    'changes nothing',
  async (t) => {
    const p = await open(t, 'viewer.html', boot(), { query: '?t=none' });
    assert.equal(
      p.win.APP_CONFIG.VERSION,
      undefined,
      'the source config has no version'
    );
    let asked = 0;
    p.win.App.fresh.read = async () => {
      asked++;
      return 'v9';
    };
    await p.fresh.check(true);
    assert.equal(asked, 0, 'a page without a version never asks');
    await p.fresh.start('');
    assert.equal(asked, 0);

    p.win.App.fresh.read = async () => {
      asked++;
      return '';
    };
    await p.fresh.start('v1');
    assert.equal(asked, 1);
    assert.deepEqual(
      [p.site.reloads, p.$('.fresh-bar')],
      [0, null],
      'offline or a failed answer: the page stays as it is'
    );
    await p.fresh.check();
    assert.equal(asked, 1, 'two checks close together ask once');
  }
);
