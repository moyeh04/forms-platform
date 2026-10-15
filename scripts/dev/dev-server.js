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
const { PIN, seed } = require('./sample-world.js');

const ROOT = path.join(__dirname, '..', '..');
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
