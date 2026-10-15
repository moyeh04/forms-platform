/**
 * What the student form tests share: a world with one open form, the
 * form opened in it, and the first two steps filled in.
 */
const { createWorld } = require('./appsscript-mock.js');
const { openPage, helpers, settle } = require('./dom.js');

const ID = (c) => c.repeat(33);

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Database Team Project Registration Form',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  return w;
}

async function open(w, opts) {
  const dom = await openPage('index.html', w, {
    query: `?f=${w.form.slug}`,
    ...opts
  });
  const win = dom.window;
  win.App.form.init();
  await settle();
  return { dom, win, ...helpers(win) };
}

const AR_NAME = 'أحمد محمد محمود أحمد';

async function fillAbout(p, code = '4230999') {
  p.type('[name="email"]', 'sara@example.com');
  p.type('[name="leader_name"]', AR_NAME);
  p.type('[name="leader_code"]', code);
  p.type('[name="phone"]', '+20 10 1234 5678');
}

async function fillStudy(p) {
  p.pick('major', 'حاسبات');
  p.pick('level', 'صفر / الأولى');
  p.pick('section', '4C-TH1');
  p.pick('curriculum', '2020');
}

module.exports = { ID, boot, open, AR_NAME, fillAbout, fillStudy };
