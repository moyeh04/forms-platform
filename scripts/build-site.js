#!/usr/bin/env node
/**
 * Package public files and generate browser configuration from API_URL.
 * The package also carries its own version, so a page that a browser kept from before a publish
 * can tell and load the new one: see siteVersion and stampPage below, and assets/js/fresh.js.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'admin.html', 'viewer.html'];
const DIRS = ['assets', 'shared'];
const CONFIG = 'assets/js/config.js';

/** A short fingerprint of some content. */
function fingerprint(...parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, 12);
}

/** Every file under a folder of the package, as sorted paths with forward slashes. */
function filesUnder(output, dir) {
  return fs.readdirSync(path.join(output, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(output, path.join(entry.parentPath || entry.path, entry.name)).split(path.sep).join('/'))
    .sort();
}

/**
 * The version of the site: a fingerprint of everything a visitor can load. It changes when a page,
 * a script, a style, a picture or the API URL changes, and stays the same for a push that touches
 * none of them, so a change to the backend or the docs reloads nobody.
 */
function siteVersion(output, url) {
  const parts = [url];
  for (const page of PAGES) parts.push(page, fs.readFileSync(path.join(output, page)));
  for (const dir of DIRS) {
    for (const file of filesUnder(output, dir)) {
      if (file !== CONFIG) parts.push(file, fs.readFileSync(path.join(output, file)));
    }
  }
  return fingerprint(...parts);
}

/**
 * Gives every script and stylesheet of the site a `?v=` made from the content of that file.
 * A browser keeps a file under its whole address, so a changed file is fetched again with the
 * page that names it, and a file that did not change stays in the cache.
 */
function stampPage(html, output) {
  return html.replace(/(<script src="|<link rel="stylesheet" href=")((?:assets|shared)\/[^"?#]+)"/g, (whole, start, file) =>
    start + file + '?v=' + fingerprint(fs.readFileSync(path.join(output, file))) + '"');
}

function apiUrl(env) {
  const value = (env.API_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value)) {
    throw new Error('API_URL must be set to the Apps Script HTTPS web app URL ending in /exec.');
  }
  if (env.APPS_SCRIPT_DEPLOYMENT_ID && value.split('/')[5] !== env.APPS_SCRIPT_DEPLOYMENT_ID) {
    throw new Error('API_URL and APPS_SCRIPT_DEPLOYMENT_ID must refer to the same deployment.');
  }
  return value;
}

function buildSite(env = process.env, output = path.join(ROOT, '_site')) {
  const url = apiUrl(env); // Validate before creating any publishable artifact.
  fs.rmSync(output, { recursive: true, force: true }); // Replace the generated output, including stale assets.
  fs.mkdirSync(output, { recursive: true });
  for (const file of PAGES) {
    fs.copyFileSync(path.join(ROOT, file), path.join(output, file));
  }
  for (const dir of DIRS) {
    fs.cpSync(path.join(ROOT, dir), path.join(output, dir), { recursive: true });
  }
  // The version is taken from the files as they are in the repository, before anything is stamped.
  const version = siteVersion(output, url);
  fs.writeFileSync(path.join(output, CONFIG),
    'window.APP_CONFIG = ' + JSON.stringify({ API_URL: url, VERSION: version }) + ';\nwindow.App = window.App || {};\n');
  for (const file of PAGES) {
    fs.writeFileSync(path.join(output, file), stampPage(fs.readFileSync(path.join(output, file), 'utf8'), output));
  }
  // An open page asks for this file to learn that a newer site is published.
  fs.writeFileSync(path.join(output, 'version.json'), JSON.stringify({ version }) + '\n');
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}

if (require.main === module) {
  try { buildSite(); console.log('Site packaged with the configured API_URL.'); }
  catch (err) { console.error(err.message); process.exitCode = 1; }
}

module.exports = { apiUrl, buildSite, siteVersion, stampPage };
