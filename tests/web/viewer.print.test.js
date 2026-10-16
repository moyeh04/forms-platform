const test = require('node:test');
const assert = require('node:assert/strict');
const { openPage, helpers, settle } = require('../harness/dom.js');
const {
  ID,
  boot,
  person,
  member,
  submit
} = require('../harness/admin-page.js');

const slots = {
  days: [
    { label: 'Week 11 - Sunday', date: '2027-11-14', times: ['12:30 - 12:50'] },
    { label: 'Week 11 - Tuesday', date: '2027-11-16', times: ['12:30 - 12:50'] }
  ],
  capacity: 1
};

function link(w, body) {
  return w.admin({
    action: 'admin.clients.create',
    name: 'Instructor 1',
    forms: ['*'],
    withKey: false,
    ...body
  }).token;
}

async function printed(w, token, slug, before) {
  const dom = await openPage('viewer.html', w, {
    query: `?t=${token}&f=${slug}`
  });
  const win = dom.window;
  await win.App.viewer.start();
  await settle(10);
  const p = { win, ...helpers(win) };
  if (before) await before(p);
  let printedTimes = 0;
  win.print = () => {
    printedTimes++;
  };
  p.click('[name="print"]');
  assert.equal(printedTimes, 1);
  return p.$('.print-sheet');
}

test('Print: a team form prints a sheet of teams, not the page', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  submit(
    w,
    f,
    person({
      title: 'Project 1',
      members: [member('سارة خالد حسن علي', '4230002')]
    })
  );
  const sheet = await printed(w, link(w, { hiddenColumns: ['phone'] }), f.slug);
  assert.equal(sheet.querySelector('h1').textContent, 'Projects');
  assert.ok(sheet.textContent.includes('1 team'));
  assert.ok(sheet.textContent.includes('Printed '));
  assert.equal(sheet.querySelector('input, select, button'), null);
  assert.deepEqual(
    [...sheet.querySelectorAll('thead th')].map((t) => t.textContent),
    ['Team', '#', 'Name', 'Section', 'Code'],
    'a hidden column is not printed'
  );
  const team = sheet.querySelector('tbody');
  assert.equal(team.querySelectorAll('tr').length, 2);
  assert.ok(team.querySelector('th').textContent.includes('Project 1'));
  assert.ok(team.textContent.includes('Leader'));
});

test('Print: a booking form prints the days it shows', async () => {
  const w = boot();
  const f = w.make('reservation', 'Seminar', { slots });
  for (const [code, day] of [
    ['4230001', 'week-11-sunday'],
    ['4230002', 'week-11-tuesday']
  ]) {
    w.api({
      action: 'submit',
      slug: f.slug,
      data: person({
        leader_code: code,
        title: 'Project 1',
        slot: { day, time: '12:30 - 12:50' }
      })
    });
  }
  const sheet = await printed(w, link(w), f.slug, async (p) => {
    p.click('[data-mode="all"]');
    await settle(8);
  });
  assert.ok(sheet.textContent.includes('All days · 2 bookings'));
  assert.deepEqual(
    [...sheet.querySelectorAll('h2')].map((x) => x.firstChild.textContent),
    ['Week 11 - Sunday (2027-11-14)', 'Week 11 - Tuesday (2027-11-16)']
  );
});

test(
  'Print: registrations print each review step as words and the ' +
    'timetable as a link',
  async () => {
    const w = boot();
    const f = w.make('whatsapp_registration', 'Groups');
    const url = `https://drive.google.com/file/d/${ID('s')}/view`;
    w.api({
      action: 'submit',
      slug: f.slug,
      data: {
        email: 'a@b.com',
        name: 'أحمد محمد محمود أحمد',
        phone: '01012345678',
        code: '4230999',
        level: 'صفر / الأولى',
        major: 'حاسبات',
        group: 'A',
        section: '21',
        schedule: url
      }
    });
    const sheet = await printed(w, link(w, { canReview: true }), f.slug);
    assert.ok(sheet.textContent.includes('1 registration'));
    assert.equal(sheet.querySelector('select'), null, 'no review controls');
    assert.ok(sheet.querySelector('.review').textContent.includes(': Pending'));
    assert.equal(sheet.querySelector('a').getAttribute('href'), url);
  }
);
