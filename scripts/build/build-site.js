#!/usr/bin/env node
/**
 * Package public files and generate browser configuration from API_URL.
 * The package also carries its own version, so a page that a browser kept
 * from before a publish can tell and load the new one: see siteVersion and
 * stampPage below, and web/js/app/fresh.js.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { PAGES, FOLDERS, sourceOf } = require('./site-map.js');

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['assets', 'shared'];
const CONFIG = 'assets/js/config.js';

/** How many hex digits of a hash make a fingerprint. */
const FINGERPRINT_DIGITS = 12;

/** A local script or stylesheet named by a page: its tag start and path. */
const LOCAL_FILE =
  /(<script src="|<link rel="stylesheet" href=")((?:assets|shared)\/[^"?#]+)"/g;

/**
 * The address of an Apps Script web app; its one group is the id of the
 * deployment.
 */
const API_URL_PATTERN =
  /^https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec$/;

/**
 * A short fingerprint of some content.
 *
 * @param {...(string|!Buffer)} parts The content.
 * @return {string} The fingerprint, in hex.
 */
function fingerprint(...parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, FINGERPRINT_DIGITS);
}

/**
 * Lists every file under a folder of the package.
 *
 * @param {string} output The package folder.
 * @param {string} dir The folder inside it.
 * @return {!Array<string>} Sorted paths from the package, with forward
 *     slashes.
 */
function filesUnder(output, dir) {
  return fs
    .readdirSync(path.join(output, dir), {
      recursive: true,
      withFileTypes: true
    })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(output, path.join(entry.parentPath || entry.path, entry.name))
        .split(path.sep)
        .join('/')
    )
    .sort();
}

/**
 * The version of the site: a fingerprint of everything a visitor can load.
 * It changes when a page, a script, a style, a picture or the API URL
 * changes, and stays the same for a push that touches none of them, so a
 * change to the backend or the docs reloads nobody.
 *
 * @param {string} output The package folder.
 * @param {string} url The API URL.
 * @return {string} The version.
 */
function siteVersion(output, url) {
  const parts = [url];
  for (const page of PAGES)
    parts.push(page, fs.readFileSync(path.join(output, page)));
  for (const dir of DIRS) {
    for (const file of filesUnder(output, dir)) {
      if (file !== CONFIG)
        parts.push(file, fs.readFileSync(path.join(output, file)));
    }
  }
  return fingerprint(...parts);
}

/**
 * Gives every script and stylesheet of the site a `?v=` made from the
 * content of that file. A browser keeps a file under its whole address, so a
 * changed file is fetched again with the page that names it, and a file that
 * did not change stays in the cache.
 *
 * @param {string} html The page.
 * @param {string} output The package folder.
 * @return {string} The page with every local script and stylesheet stamped.
 */
function stampPage(html, output) {
  return html.replace(
    LOCAL_FILE,
    (_whole, start, file) =>
      start +
      file +
      '?v=' +
      fingerprint(fs.readFileSync(path.join(output, file))) +
      '"'
  );
}

/**
 * Reads and checks the API URL.
 *
 * @param {!Object<string, string>} env The environment of the build.
 * @return {string} The URL.
 * @throws {Error} When it is not an Apps Script web app URL, or not the
 *     deployment the build names.
 */
function apiUrl(env) {
  const value = (env.API_URL || '').trim();
  const match = API_URL_PATTERN.exec(value);
  if (!match) {
    throw new Error(
      'API_URL must be set to the Apps Script HTTPS web app URL ending in' +
        ' /exec.'
    );
  }
  if (
    env.APPS_SCRIPT_DEPLOYMENT_ID &&
    match[1] !== env.APPS_SCRIPT_DEPLOYMENT_ID
  ) {
    throw new Error(
      'API_URL and APPS_SCRIPT_DEPLOYMENT_ID must refer to the same deployment.'
    );
  }
  return value;
}

/**
 * Packages the site.
 *
 * @param {!Object<string, string>} env The environment of the build.
 * @param {string} output The package folder, emptied first.
 * @return {string} The package folder.
 */
function buildSite(env = process.env, output = path.join(ROOT, '_site')) {
  // Validate before creating any publishable artifact.
  const url = apiUrl(env);
  // Replace the generated output, including stale assets.
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of PAGES) {
    fs.copyFileSync(path.join(ROOT, sourceOf(file)), path.join(output, file));
  }
  for (const { published, source } of FOLDERS) {
    fs.cpSync(path.join(ROOT, source), path.join(output, published), {
      recursive: true
    });
  }
  // The version is taken from the files as they are in the repository,
  // before anything is stamped.
  const version = siteVersion(output, url);
  fs.writeFileSync(
    path.join(output, CONFIG),
    'window.APP_CONFIG = ' +
      JSON.stringify({ API_URL: url, VERSION: version }) +
      ';\nwindow.App = window.App || {};\n'
  );
  for (const file of PAGES) {
    fs.writeFileSync(
      path.join(output, file),
      stampPage(fs.readFileSync(path.join(output, file), 'utf8'), output)
    );
  }
  // An open page asks for this file to learn that a newer site is published.
  fs.writeFileSync(
    path.join(output, 'version.json'),
    JSON.stringify({ version }) + '\n'
  );
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}

if (require.main === module) {
  try {
    buildSite();
    console.log('Site packaged with the configured API_URL.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = { apiUrl, buildSite, siteVersion, stampPage };
