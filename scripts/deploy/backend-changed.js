#!/usr/bin/env node
/**
 * Says whether a push changed what the Apps Script deployment is made of, so a push of pages
 * or documents alone does not publish a new backend version.
 *
 * It compares the pushed commit with the one before the push. Whenever that cannot be done
 * (a first push, a rewritten branch, a run started by hand) the answer is yes: deploying an
 * unchanged backend costs a minute, skipping a changed one leaves the site on old code.
 */
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

/** The folders and files the bundle and its deployment are made from. */
const BACKEND_PATHS = ['backend/', 'shared/', 'scripts/build/bundle-backend.js', 'scripts/deploy/prepare-clasp.js', '.github/workflows/pages.yml'];

function touchesBackend(files) {
  return files.some((file) => BACKEND_PATHS.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p)));
}

function changedFiles(before, run = execFileSync) {
  if (!/^[0-9a-f]{40}$/.test(before || '') || /^0+$/.test(before)) return null;
  try {
    run('git', ['fetch', '--quiet', '--depth=1', 'origin', before], { stdio: 'ignore' });
    return String(run('git', ['diff', '--name-only', before, 'HEAD'])).split('\n').filter(Boolean);
  } catch (_) {
    return null;
  }
}

function backendChanged(env = process.env, run = execFileSync) {
  if (env.GITHUB_EVENT_NAME !== 'push') return { changed: true, why: 'the run was not started by a push' };
  const files = changedFiles(env.BEFORE, run);
  if (!files) return { changed: true, why: 'the commit before this push could not be compared' };
  const changed = touchesBackend(files);
  return { changed, why: changed ? 'a backend file changed' : 'no backend file changed in ' + files.length + ' changed files' };
}

if (require.main === module) {
  const result = backendChanged();
  console.log('Deploy the backend: ' + (result.changed ? 'yes' : 'no') + ' (' + result.why + ').');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'backend=' + result.changed + '\n');
}

module.exports = { BACKEND_PATHS, backendChanged, touchesBackend };
