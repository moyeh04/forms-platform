#!/usr/bin/env node
/**
 * Local preview: serves the website and answers its API calls from the same
 * in-memory Google the tests use, so every page can be opened in a real
 * browser without a Google account and without touching real data.
 *
 *   npm run dev            # http://localhost:8080  (admin PIN 4321)
 *   npm run dev -- 9000    # another port
 *   npm run dev -- --empty # no sample forms
 *   npm run dev -- --folder <id>=<name>   # name a pretend Drive folder (repeatable)
 *
 * Everything lives in memory and disappears when the server stops.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createWorld } = require('../../tests/harness/appsscript-mock.js');
const { sourceOf } = require('../build/site-map.js');

const ROOT = path.join(__dirname, '..', '..');
const PIN = '4321';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json'
};

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

function start(port, opts) {
  const world = createWorld();
  const info = opts.empty
    ? (world.setNow(Date.now()),
      world.call('setup'),
      world.call('setAdminPin', PIN),
      {})
    : seed(world);
  // Drive is pretend here: a folder's name is its id unless one is given, so demos can pass the naming rule.
  (opts.folders || []).forEach(([id, name]) =>
    world.drive.setFolderName(id, name)
  );

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        world.setNow(Date.now());
        let out;
        try {
          out = world.api(JSON.parse(body));
        } catch (e) {
          out = { ok: false, error: { code: 'bad_json', message: e.message } };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
      return;
    }
    if (url.pathname === '/assets/js/config.js') {
      res.writeHead(200, { 'Content-Type': TYPES['.js'] });
      res.end(
        "window.APP_CONFIG = { API_URL: location.origin + '/api' };\nwindow.App = window.App || {};\n"
      );
      return;
    }
    // Only the files of the site, at the paths they are published at.
    const pathname = decodeURIComponent(url.pathname);
    const source = sourceOf(pathname === '/' ? 'index.html' : pathname);
    if (!source) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const file = path.join(ROOT, source);
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });

  // Local only: the preview has a known PIN and must not be reachable from the network.
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve({ server, world, info }))
  );
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = parseInt(
    args.find((a) => /^\d+$/.test(a)) || process.env.PORT || '8080',
    10
  );
  const folders = args
    .map((a, i) => (a === '--folder' ? args[i + 1] : null))
    .filter(Boolean)
    .map((v) => [v.slice(0, v.indexOf('=')), v.slice(v.indexOf('=') + 1)]);
  start(port, { empty: args.includes('--empty'), folders }).then(({ info }) => {
    const base = `http://localhost:${port}`;
    console.log(
      `Forms Platform preview on ${base}  (in memory, nothing reaches Google)`
    );
    console.log(`  Admin:    ${base}/admin.html   PIN ${PIN}`);
    if (info.team)
      console.log(`  Form:     ${base}/index.html?f=${info.team.slug}`);
    if (info.viewerToken)
      console.log(
        `  Viewer:   ${base}/viewer.html?t=${info.viewerToken}   access key ${info.viewerKey}`
      );
    if (info.discussion)
      console.log(
        `  Book with a key: ${base}/index.html?f=${info.discussion.slug}   key ${info.key}`
      );
  });
}

module.exports = { start, PIN };
