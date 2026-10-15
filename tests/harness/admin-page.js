/**
 * What the dashboard tests share: a world with an admin PIN and a way to
 * make open forms, the dashboard opened in it, and the answers of a team.
 */
const { createWorld } = require('./appsscript-mock.js');
const { openPage, helpers, settle } = require('./dom.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.make = (type, title, patch = {}) => {
    const f = w.admin({
      action: 'admin.forms.create',
      type,
      title,
      term: 'Fall 2027',
      batchYear: '2027/2028'
    }).form;
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open', ...patch }
    });
    return f;
  };
  return w;
}

async function openAdmin(w, hash = '', login = true) {
  const dom = await openPage('admin.html', w, { hash });
  const win = dom.window;
  if (login) win.App.api.setPin('4321');
  await win.App.admin.start();
  await settle(10);
  return { dom, win, ...helpers(win) };
}

const person = (o) => ({
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

const member = (name, code) => ({
  name,
  phone: '01112345678',
  code,
  level: 'صفر / الأولى',
  curriculum: '2020',
  section: '4C-TH1'
});

const submit = (w, f, d) =>
  w.api({
    action: 'submit',
    slug: f.slug,
    data: { team_size: String((d.members || []).length + 1), ...d }
  });

module.exports = { ID, boot, openAdmin, person, member, submit };
