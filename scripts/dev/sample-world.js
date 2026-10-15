/** The sample forms and registrations of the local preview. */

const PIN = '4321';

/** Builds a world with a few forms and registrations so every page has something to show. */
function seed(world) {
  world.setNow(Date.now());
  world.call('setup');
  world.call('setAdminPin', PIN);
  const admin = (b) => world.api({ ...b, admin: { pin: PIN } });
  const make = (type, title, term, patch) => {
    const f = admin({ action: 'admin.forms.create', type, title, term }).form;
    admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open', ...patch }
    });
    return f;
  };
  const leader = (o) => ({
    email: 'student@example.com',
    phone: '01012345678',
    major: 'حاسبات',
    level: 'الثاني / الثالثة',
    section: '4C-TH2',
    curriculum: '2020',
    ...o
  });
  const mem = (name, code, phone) => ({
    name,
    code,
    phone,
    level: 'الثاني / الثالثة',
    curriculum: '2020',
    section: '4C-TH2'
  });

  const team = make(
    'team_registration',
    'Database Team Project Registration Form',
    'Fall 2027',
    {}
  );
  const registered = [
    leader({
      leader_name: 'أحمد محمد محمود علي',
      leader_code: '4230459',
      title: 'Library System',
      team_size: '3',
      members: [
        mem('سارة خالد حسن علي', '4230441', '01112345678'),
        mem('منى أشرف كمال فؤاد', '4230423', '01212345678')
      ]
    }),
    leader({
      leader_name: 'يوسف إبراهيم سيد حسن',
      leader_code: '4230501',
      phone: '01098765432',
      title: 'Clinic Booking',
      team_size: '2',
      members: [mem('عمر طارق عبد الله محمد', '4230502', '01198765432')]
    }),
    leader({
      leader_name: 'نور الدين أحمد فتحي سالم',
      leader_code: '4230611',
      phone: '01055512345',
      title: 'Smart Parking',
      team_size: '1',
      members: []
    })
  ].map((data, i) => {
    // The last team registered ten days ago, so its key has expired and Extend keys has something to show.
    if (i === 2) world.setNow(Date.now() - 10 * 86400000);
    const r = world.api({ action: 'submit', slug: team.slug, data });
    world.setNow(Date.now());
    return r;
  });

  // A reservation filled in by hand, two places a time, so the places left can be seen.
  make('reservation', 'Microprocessor Project Seminar', 'Spring 2028', {
    slots: {
      days: [
        {
          label: 'Tuesday 16 Nov',
          date: '2027-11-16',
          times: world.ctx.Rules.generateSlots({
            start: '10:00',
            end: '11:00',
            length: 25,
            gap: 5
          })
        }
      ],
      capacity: 2
    }
  });
  // A reservation booked with the keys of the team form, so that flow can be tried with a real key.
  // The other two teams have taken both times of the second day, so a full day can be seen.
  const discussion = make(
    'reservation',
    'Database Project Discussion',
    'Fall 2027',
    {
      slots: {
        days: [
          {
            label: 'Sunday 14 Nov',
            date: '2027-11-14',
            times: world.ctx.Rules.generateSlots({
              start: '12:30',
              end: '14:00',
              length: 20,
              gap: 5
            })
          },
          {
            label: 'Monday 15 Nov',
            date: '2027-11-15',
            times: ['12:30 - 12:50', '12:55 - 1:15']
          }
        ],
        capacity: 1
      },
      keyBooking: { enabled: true, source: team.id }
    }
  );
  const days = admin({ action: 'admin.forms.get', id: discussion.id }).form
    .slots.days;
  [1, 2].forEach((i) =>
    world.api({
      action: 'submit',
      slug: discussion.slug,
      sourceKey: registered[i].key,
      data: { slot: { day: days[1].id, time: days[1].times[i - 1] } }
    })
  );
  const groups = make(
    'whatsapp_registration',
    'Level 2 WhatsApp Groups',
    'Fall 2027',
    {}
  );
  [
    ['هدى سامي عادل منصور', '4230710', '01033344455', 'A'],
    ['كريم وليد حسن جابر', '4230722', '01144455566', 'B']
  ].forEach(([name, code, phone, group]) => {
    world.api({
      action: 'submit',
      slug: groups.slug,
      data: {
        email: 'student@example.com',
        name,
        phone,
        code,
        level: 'الثاني / الثالثة',
        major: 'حاسبات',
        group,
        section: '21',
        schedule:
          'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'
      }
    });
  });
  // A task form whose files are in pretend Drive, so Download all has something to pack.
  const tasks = make(
    'task_submission',
    'Software Engineering Tasks',
    'Fall 2027',
    {}
  );
  [
    ['Task 1', 'application/vnd.google-apps.presentation', ''],
    ['Task 2.pdf', 'application/pdf', '%PDF-1.4 Task 2'],
    ['Task 3', 'application/vnd.google-apps.form', '']
  ].forEach(([name, mime, bytes], i) => {
    const id = String.fromCharCode(107 + i).repeat(33);
    world.drive.addFile({ id, name, mime, bytes });
    world.api({
      action: 'submit',
      slug: tasks.slug,
      data: leader({
        leader_name: [
          'سلمى فؤاد نبيل عيسى',
          'يوسف ماهر رشدي لطفي',
          'نادين شريف عزت فهمي'
        ][i],
        leader_code: '42305' + (10 + i),
        title: name.replace(/\.pdf$/, ''),
        team_size: '1',
        members: [],
        link: `https://docs.google.com/presentation/d/${id}/edit`
      })
    });
  });
  world.fetch = (url, o) => {
    const media = /files\/([\w-]+)\?alt=media/.exec(url);
    if (!media)
      return {
        getResponseCode: () => 200,
        getBlob: () =>
          new world.MockBlob('Exported ' + url, 'application/octet-stream', 'x')
      };
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(o.headers.Range).map(Number);
    const buf = world.drive.files.get(media[1]).buf.slice(from, to + 1);
    return { getResponseCode: () => 206, getContent: () => Array.from(buf) };
  };
  const client = admin({
    action: 'admin.clients.create',
    name: 'Dr. Mahmoud - Database',
    forms: [team.slug],
    hiddenColumns: [],
    canReview: false
  });
  return {
    team,
    viewerToken: client.token,
    viewerKey: client.accessKey,
    discussion,
    key: registered[0].key
  };
}

module.exports = { PIN, seed };
