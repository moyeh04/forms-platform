#!/usr/bin/env node
/**
 * Local preview: serves the website and answers its API calls from the same
 * in-memory Google the tests use, so every page can be opened in a real
 * browser without a Google account and without touching real data.
 *
 *   npm run dev            # http://localhost:8080  (admin PIN 4321)
 *   npm run dev -- 9000    # another port
 *   npm run dev -- --empty # no sample forms
 *   npm run dev -- --folder <id>=<name>   # name a pretend Drive folder
 *                                         # (repeatable)
 *
 * Everything lives in memory and disappears when the server stops.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createWorld } = require('../../tests/harness/appsscript-mock.js');
const { sourceOf } = require('../build/site-map.js');
const { PIN, prepareWorld, seed } = require('./sample-world.js');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_PORT = 8080;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/** The configuration the pages read: the API is this server. */
const CONFIG =
  "window.APP_CONFIG = { API_URL: location.origin + '/api' };\n" +
  'window.App = window.App || {};\n';

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

/**
 * Answers an API call from the world.
 *
 * @param {!Object} world The in-memory Google.
 * @param {!http.IncomingMessage} req The request.
 * @param {!http.ServerResponse} res The answer.
 */
function answerApi(world, req, res) {
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
    res.writeHead(HTTP_OK, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
}

/**
 * Answers that a file is not part of the site.
 *
 * @param {!http.ServerResponse} res The answer.
 */
function notFound(res) {
  res.writeHead(HTTP_NOT_FOUND);
  res.end('Not found');
}

/**
 * Sends a file of the site, from the path it is published at.
 *
 * @param {string} pathname The path asked for.
 * @param {!http.ServerResponse} res The answer.
 */
function sendFile(pathname, res) {
  const source = sourceOf(pathname === '/' ? 'index.html' : pathname);
  if (!source) {
    notFound(res);
    return;
  }
  const file = path.join(ROOT, source);
  fs.readFile(file, (err, buf) => {
    if (err) {
      notFound(res);
      return;
    }
    res.writeHead(HTTP_OK, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

/**
 * Answers a request: an API call, the configuration, or a file of the site.
 *
 * @param {!Object} world The in-memory Google.
 * @param {!http.IncomingMessage} req The request.
 * @param {!http.ServerResponse} res The answer.
 */
function answer(world, req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api') {
    answerApi(world, req, res);
  } else if (url.pathname === '/assets/js/config.js') {
    res.writeHead(HTTP_OK, { 'Content-Type': TYPES['.js'] });
    res.end(CONFIG);
  } else {
    // Only the files of the site, at the paths they are published at.
    sendFile(decodeURIComponent(url.pathname), res);
  }
}

/**
 * Starts the preview.
 *
 * @param {number} port The port.
 * @param {{empty: (boolean|undefined),
 *     folders: (!Array<!Array<string>>|undefined)}} opts Whether to leave
 *     out the sample forms, and the names of pretend Drive folders as
 *     [id, name].
 * @return {!Promise<{server: !http.Server, world: !Object, info: !Object}>}
 *     The server, its world, and what the sample world made.
 */
function start(port, opts) {
  const world = createWorld();
  let info = {};
  if (opts.empty) prepareWorld(world);
  else info = seed(world);
  // Drive is pretend here: a folder's name is its id unless one is given, so
  // demos can pass the naming rule.
  for (const [id, name] of opts.folders || []) {
    world.drive.setFolderName(id, name);
  }
  const server = http.createServer(answer.bind(null, world));
  // Local only: the preview has a known PIN and must not be reachable from
  // the network.
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve({ server, world, info }))
  );
}

/**
 * Reads the command line: a port, --empty, and --folder <id>=<name>.
 *
 * @param {!Array<string>} args The arguments.
 * @return {{port: number, empty: boolean, folders: !Array<!Array<string>>}}
 *     What they ask for.
 */
function readArgs(args) {
  const port = Number(
    args.find((a) => /^\d+$/.test(a)) || process.env.PORT || DEFAULT_PORT
  );
  const folders = args
    .map((a, i) => (a === '--folder' ? args[i + 1] : null))
    .filter(Boolean)
    .map((v) => [v.slice(0, v.indexOf('=')), v.slice(v.indexOf('=') + 1)]);
  return { port, empty: args.includes('--empty'), folders };
}

/**
 * Prints the addresses of the pages with sample data.
 *
 * @param {number} port The port.
 * @param {!Object} info What the sample world made.
 */
function printLinks(port, info) {
  const base = `http://localhost:${port}`;
  console.log(
    `Forms Platform preview on ${base}  (in memory, nothing reaches Google)`
  );
  console.log(`  Admin:    ${base}/admin.html   PIN ${PIN}`);
  if (info.team)
    console.log(`  Form:     ${base}/index.html?f=${info.team.slug}`);
  if (info.viewerToken)
    console.log(
      `  Viewer:   ${base}/viewer.html?t=${info.viewerToken}` +
        `   access key ${info.viewerKey}`
    );
  if (info.discussion)
    console.log(
      `  Book with a key: ${base}/index.html?f=${info.discussion.slug}` +
        `   key ${info.key}`
    );
}

if (require.main === module) {
  const opts = readArgs(process.argv.slice(2));
  start(opts.port, opts).then(({ info }) => printLinks(opts.port, info));
}

module.exports = { start, PIN };
