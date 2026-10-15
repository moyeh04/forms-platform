const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);

function boot() {
  const w = createWorld({ now: Date.parse('2027-11-14T09:00:00Z') });
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const mk = (type, title, patch = {}) => {
    const f = w.admin({
      action: 'admin.forms.create',
      type,
      title,
      term: 'Fall 2027'
    }).form;
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open', ...patch }
    });
    return f;
  };
  w.res = mk('reservation', 'Seminar', {
    slots: {
      days: [
        {
          label: 'Week 11 - Sunday',
          date: '2027-11-14',
          times: ['12:30 - 12:50', '12:55 - 1:15']
        },
        {
          label: 'Week 11 - Tuesday',
          date: '2027-11-16',
          times: ['12:30 - 12:50']
        }
      ],
      capacity: 1
    }
  });
  w.team = mk('task_submission', 'Tasks');
  w.wa = mk('whatsapp_registration', 'Group A and B');
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
  const book = (code, day, time, title) =>
    w.api({
      action: 'submit',
      slug: w.res.slug,
      data: person({ leader_code: code, title, slot: { day, time } })
    });
  book('4230001', 'week-11-sunday', '12:55 - 1:15', 'Second');
  book('4230002', 'week-11-sunday', '12:30 - 12:50', 'First');
  book('4230003', 'week-11-tuesday', '12:30 - 12:50', 'Later');
  w.api({
    action: 'submit',
    slug: w.team.slug,
    data: person({
      title: 'Normalization',
      link: `https://docs.google.com/presentation/d/${ID('a')}/edit`,
      members: [
        {
          name: 'سارة خالد حسن علي',
          phone: '01112345678',
          code: '4230009',
          level: 'صفر / الأولى',
          curriculum: '2020',
          section: '4C-TH1'
        }
      ]
    })
  });
  w.api({
    action: 'submit',
    slug: w.wa.slug,
    data: {
      email: 'a@b.com',
      name: 'أحمد محمد محمود أحمد',
      phone: '01012345678',
      code: '4230001',
      level: 'صفر / الأولى',
      major: 'حاسبات',
      group: 'A',
      section: '21',
      schedule: `https://drive.google.com/file/d/${ID('w')}/view`
    }
  });
  w.client = (o = {}) =>
    w.admin({
      action: 'admin.clients.create',
      name: 'Dr. Hassan',
      forms: [w.res.slug],
      withKey: false,
      ...o
    });
  w.data = (token, slug, extra = {}) =>
    w.api({ action: 'viewer.data', token, slug, ...extra });
  return w;
}

test('Clients: a link is created once, the token itself is never stored', () => {
  const w = boot();
  const c = w.client();
  assert.match(c.token, /^[0-9a-f]{24}$/);
  const row = w.registry.getSheetByName('Clients').rows()[1];
  assert.equal(row.join('|').includes(c.token), false);
  assert.equal(
    w.admin({ action: 'admin.clients.list' }).clients[0].tokenHash,
    undefined
  );
  assert.equal(
    w.admin({ action: 'admin.clients.create', name: ' ' }).error.code,
    'name_required'
  );
  assert.equal(
    w.admin({ action: 'admin.clients.create', name: 'X', forms: ['missing'] })
      .error.code,
    'form_not_found'
  );
});
