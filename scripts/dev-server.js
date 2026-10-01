#!/usr/bin/env node
/**
 * Local preview: serves the website and answers its API calls from the same
 * in-memory Google the tests use, so every page can be opened in a real
 * browser without a Google account and without touching real data.
 *
 *   npm run dev            # http://localhost:8080  (admin PIN 4321)
 *   npm run dev -- 9000    # another port
 *   npm run dev -- --empty # no sample forms
 *
 * Everything lives in memory and disappears when the server stops.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createWorld } = require('../tests/harness/appsscript-mock.js');

const ROOT = path.join(__dirname, '..');
const PIN = '4321';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

/** Builds a world with a few forms and registrations so every page has something to show. */
function seed(world) {
  world.setNow(Date.now());
  world.call('setup');
  world.call('setAdminPin', PIN);
  const admin = (b) => world.api({ ...b, admin: { pin: PIN } });
  const make = (type, title, term, patch) => {
    const f = admin({ action: 'admin.forms.create', type, title, term }).form;
    admin({ action: 'admin.forms.update', id: f.id, patch: { status: 'open', ...patch } });
    return f;
  };
  const leader = (o) => ({
    email: 'student@example.com', phone: '01012345678', major: 'حاسبات', level: 'الثاني / الثالثة', section: '4C-TH2', curriculum: '2020', ...o
  });
  const mem = (name, code, phone) => ({ name, code, phone, level: 'الثاني / الثالثة', curriculum: '2020', section: '4C-TH2' });

  const team = make('team_registration', 'Database Team Project Registration Form', 'Fall 2027', {});
  [
    leader({ leader_name: 'أحمد محمد محمود علي', leader_code: '4230451', title: 'Library System', team_size: '3', members: [mem('سارة خالد حسن علي', '4230441', '01112345678'), mem('منى أشرف كمال فؤاد', '4230423', '01212345678')] }),
    leader({ leader_name: 'يوسف إبراهيم سيد حسن', leader_code: '4230501', phone: '01098765432', title: 'Clinic Booking', team_size: '2', members: [mem('عمر طارق عبد الله محمد', '4230502', '01198765432')] }),
    leader({ leader_name: 'نور الدين أحمد فتحي سالم', leader_code: '4230611', phone: '01055512345', title: 'Smart Parking', team_size: '1', members: [] })
  ].forEach((data) => world.api({ action: 'submit', slug: team.slug, data }));

  make('reservation', 'Microprocessor Project Seminar', 'Spring 2028', {});
  make('whatsapp_registration', 'Level 2 WhatsApp Groups', 'Fall 2027', {});
  const client = admin({ action: 'admin.clients.create', name: 'Dr. Mahmoud - Database', forms: [team.slug], hiddenColumns: [], canReview: false });
  return { team, viewerToken: client.token };
}

function start(port, opts) {
  const world = createWorld();
  const info = opts.empty ? (world.setNow(Date.now()), world.call('setup'), world.call('setAdminPin', PIN), {}) : seed(world);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        world.setNow(Date.now());
        let out;
        try { out = world.api(JSON.parse(body)); } catch (e) { out = { ok: false, error: { code: 'bad_json', message: e.message } }; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
      return;
    }
    if (url.pathname === '/assets/js/config.js') {
      res.writeHead(200, { 'Content-Type': TYPES['.js'] });
      res.end("window.APP_CONFIG = { API_URL: location.origin + '/api' };\nwindow.App = window.App || {};\n");
      return;
    }
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });

  return new Promise((resolve) => server.listen(port, () => resolve({ server, world, info })));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = parseInt(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || '8080', 10);
  start(port, { empty: args.includes('--empty') }).then(({ info }) => {
    const base = `http://localhost:${port}`;
    console.log(`Forms Platform preview on ${base}  (in memory, nothing reaches Google)`);
    console.log(`  Admin:    ${base}/admin.html   PIN ${PIN}`);
    if (info.team) console.log(`  Form:     ${base}/index.html?f=${info.team.slug}`);
    if (info.viewerToken) console.log(`  Viewer:   ${base}/viewer.html?t=${info.viewerToken}`);
  });
}

module.exports = { start, PIN };
