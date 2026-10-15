/** The sample forms and registrations of the local preview. */

const PIN = '4321';

/** One day, in milliseconds. */
const DAY_MS = 86_400_000;

/** How long ago the last sample team registered, so its key has expired. */
const EXPIRED_DAYS = 10;

/** How many characters a pretend Drive file id has. */
const DRIVE_ID_LENGTH = 33;

/** The HTTP status of a whole answer. */
const HTTP_OK = 200;

/** The HTTP status of a part of a file. */
const HTTP_PARTIAL = 206;

/** The times of the seminar: 25 minutes each, 5 minutes apart. */
const SEMINAR_TIMES = {
  start: '10:00',
  end: '11:00',
  length: 25,
  gap: 5
};

/** The times of the first discussion day: 20 minutes each, 5 apart. */
const DISCUSSION_TIMES = {
  start: '12:30',
  end: '14:00',
  length: 20,
  gap: 5
};

/** The study details every sample student shares. */
const STUDY = {
  level: 'الثاني / الثالثة',
  curriculum: '2020',
  section: '4C-TH2'
};

/**
 * Builds the answers of a team leader, from shared sample details.
 *
 * @param {!Object} o The answers that differ.
 * @return {!Object} The answers.
 */
function leader(o) {
  return {
    email: 'student@example.com',
    phone: '01012345678',
    major: 'حاسبات',
    ...STUDY,
    ...o
  };
}

/**
 * Builds a team member.
 *
 * @param {string} name The name.
 * @param {string} code The student code.
 * @param {string} phone The phone.
 * @return {!Object} The member.
 */
function member(name, code, phone) {
  return { name, code, phone, ...STUDY };
}

/**
 * Calls the API as the admin.
 *
 * @param {!Object} world The in-memory Google.
 * @param {!Object} body The request.
 * @return {!Object} The answer.
 */
function asAdmin(world, body) {
  return world.api({ ...body, admin: { pin: PIN } });
}

/**
 * Creates a form and opens it.
 *
 * @param {!Object} world The in-memory Google.
 * @param {{type: string, title: string, term: string}} form What it is.
 * @param {!Object=} patch The settings to change after it is made.
 * @return {!Object} The form.
 */
function openForm(world, form, patch) {
  const f = asAdmin(world, { action: 'admin.forms.create', ...form }).form;
  asAdmin(world, {
    action: 'admin.forms.update',
    id: f.id,
    patch: { status: 'open', ...patch }
  });
  return f;
}

/**
 * Makes the team form and registers three teams. The last team registered
 * ten days ago, so its key has expired and Extend keys has something to
 * show.
 *
 * @param {!Object} world The in-memory Google.
 * @return {{team: !Object, registered: !Array<!Object>}} The form and the
 *     answers of each registration.
 */
function seedTeams(world) {
  const team = openForm(world, {
    type: 'team_registration',
    title: 'Database Team Project Registration Form',
    term: 'Fall 2027'
  });
  const teams = [
    leader({
      leader_name: 'أحمد محمد محمود علي',
      leader_code: '4230459',
      title: 'Library System',
      team_size: '3',
      members: [
        member('سارة خالد حسن علي', '4230441', '01112345678'),
        member('منى أشرف كمال فؤاد', '4230423', '01212345678')
      ]
    }),
    leader({
      leader_name: 'يوسف إبراهيم سيد حسن',
      leader_code: '4230501',
      phone: '01098765432',
      title: 'Clinic Booking',
      team_size: '2',
      members: [member('عمر طارق عبد الله محمد', '4230502', '01198765432')]
    }),
    leader({
      leader_name: 'نور الدين أحمد فتحي سالم',
      leader_code: '4230611',
      phone: '01055512345',
      title: 'Smart Parking',
      team_size: '1',
      members: []
    })
  ];
  const expired = teams.length - 1;
  const registered = teams.map((data, i) => {
    if (i === expired) world.setNow(Date.now() - EXPIRED_DAYS * DAY_MS);
    const r = world.api({ action: 'submit', slug: team.slug, data });
    world.setNow(Date.now());
    return r;
  });
  return { team, registered };
}

/**
 * Makes a reservation filled in by hand, two places a time, so the places
 * left can be seen.
 *
 * @param {!Object} world The in-memory Google.
 */
function seedSeminar(world) {
  openForm(
    world,
    {
      type: 'reservation',
      title: 'Microprocessor Project Seminar',
      term: 'Spring 2028'
    },
    {
      slots: {
        days: [
          {
            label: 'Tuesday 16 Nov',
            date: '2027-11-16',
            times: world.ctx.Rules.generateSlots(SEMINAR_TIMES)
          }
        ],
        capacity: 2
      }
    }
  );
}

/**
 * Makes a reservation booked with the keys of the team form, so that flow
 * can be tried with a real key. The other two teams take both times of the
 * second day, so a full day can be seen.
 *
 * @param {!Object} world The in-memory Google.
 * @param {!Object} team The team form.
 * @param {!Array<!Object>} registered The registrations of the team form.
 * @return {!Object} The reservation form.
 */
function seedDiscussion(world, team, registered) {
  const discussion = openForm(
    world,
    {
      type: 'reservation',
      title: 'Database Project Discussion',
      term: 'Fall 2027'
    },
    {
      slots: {
        days: [
          {
            label: 'Sunday 14 Nov',
            date: '2027-11-14',
            times: world.ctx.Rules.generateSlots(DISCUSSION_TIMES)
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
  const day = asAdmin(world, { action: 'admin.forms.get', id: discussion.id })
    .form.slots.days[1];
  day.times.forEach((time, i) => {
    world.api({
      action: 'submit',
      slug: discussion.slug,
      sourceKey: registered[i + 1].key,
      data: { slot: { day: day.id, time } }
    });
  });
  return discussion;
}

/**
 * Makes a WhatsApp form with two registrations.
 *
 * @param {!Object} world The in-memory Google.
 */
function seedGroups(world) {
  const groups = openForm(world, {
    type: 'whatsapp_registration',
    title: 'Level 2 WhatsApp Groups',
    term: 'Fall 2027'
  });
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
        level: STUDY.level,
        major: 'حاسبات',
        group,
        section: '21',
        schedule:
          'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'
      }
    });
  });
}

/**
 * Makes a task form whose files are in pretend Drive, so Download all has
 * something to pack.
 *
 * @param {!Object} world The in-memory Google.
 */
function seedTasks(world) {
  const tasks = openForm(world, {
    type: 'task_submission',
    title: 'Software Engineering Tasks',
    term: 'Fall 2027'
  });
  [
    ['Task 1', 'application/vnd.google-apps.presentation', '', 'k'],
    ['Task 2.pdf', 'application/pdf', '%PDF-1.4 Task 2', 'l'],
    ['Task 3', 'application/vnd.google-apps.form', '', 'm']
  ].forEach(([name, mime, bytes, letter], i) => {
    const id = letter.repeat(DRIVE_ID_LENGTH);
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
        leader_code: ['4230510', '4230511', '4230512'][i],
        title: name.replace(/\.pdf$/, ''),
        team_size: '1',
        members: [],
        link: `https://docs.google.com/presentation/d/${id}/edit`
      })
    });
  });
}

/**
 * Answers the Drive downloads of the server: a part of a pretend file, or
 * an export of a Google file.
 *
 * @param {!Object} world The in-memory Google.
 * @param {string} url The address asked for.
 * @param {!Object} o The options of the request.
 * @return {!Object} The answer, as UrlFetchApp gives it.
 */
function fakeFetch(world, url, o) {
  const media = /files\/([\w-]+)\?alt=media/.exec(url);
  if (!media)
    return {
      /**
       * Says the whole export is sent.
       *
       * @return {number} The status.
       */
      getResponseCode: () => HTTP_OK,
      /**
       * Gives the export.
       *
       * @return {!Object} The exported file.
       */
      getBlob: () =>
        new world.MockBlob('Exported ' + url, 'application/octet-stream', 'x')
    };
  const [, from, to] = /bytes=(\d+)-(\d+)/.exec(o.headers.Range).map(Number);
  const buf = world.drive.files.get(media[1]).buf.slice(from, to + 1);
  return {
    /**
     * Says a part is sent.
     *
     * @return {number} The status.
     */
    getResponseCode: () => HTTP_PARTIAL,
    /**
     * Gives the part.
     *
     * @return {!Array<number>} Its bytes.
     */
    getContent: () => Array.from(buf)
  };
}

/**
 * Builds a world with a few forms and registrations so every page has
 * something to show.
 *
 * @param {!Object} world The in-memory Google.
 * @return {{team: !Object, viewerToken: string, viewerKey: string,
 *     discussion: !Object, key: string}} What the preview prints: the team
 *     form, an instructor link and its key, and a form booked with a key.
 */
function seed(world) {
  world.setNow(Date.now());
  world.call('setup');
  world.call('setAdminPin', PIN);
  const { team, registered } = seedTeams(world);
  seedSeminar(world);
  const discussion = seedDiscussion(world, team, registered);
  seedGroups(world);
  seedTasks(world);
  world.fetch = fakeFetch.bind(null, world);
  const client = asAdmin(world, {
    action: 'admin.clients.create',
    name: 'Instructor 1 - Database',
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
