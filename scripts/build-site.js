#!/usr/bin/env node
/** Package public files and generate browser configuration from API_URL. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

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
  for (const file of ['index.html', 'admin.html', 'viewer.html']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(output, file));
  }
  for (const dir of ['assets', 'shared']) {
    fs.cpSync(path.join(ROOT, dir), path.join(output, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(output, 'assets/js/config.js'),
    'window.APP_CONFIG = ' + JSON.stringify({ API_URL: url }) + ';\nwindow.App = window.App || {};\n');
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}

if (require.main === module) {
  try { buildSite(); console.log('Site packaged with the configured API_URL.'); }
  catch (err) { console.error(err.message); process.exitCode = 1; }
}

module.exports = { apiUrl, buildSite };
