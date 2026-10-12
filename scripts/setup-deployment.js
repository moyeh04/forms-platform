#!/usr/bin/env node
/** First deployment from a workstation: push the backend, create the web app, configure GitHub. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { claspProject } = require('./prepare-clasp.js');

const ROOT = path.resolve(__dirname, '..');
const CLASP = '@google/clasp@3.4.1'; // Same pinned version as .github/workflows/pages.yml.
const PAGES = 'repos/{owner}/{repo}/pages';

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32',
    input: options.input, stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe']
  });
}

/** clasp prints "Deployed <id> @<version>"; the ID is the only long token before the version. */
function deploymentId(output) {
  const match = /([A-Za-z0-9_-]{20,})\s+@\d+/.exec(output || '');
  if (!match) throw new Error('clasp did not report a deployment ID. Its output was:\n' + (output || '(empty)'));
  return match[1];
}

function setup(scriptId, options = {}) {
  const run = options.run || execute;
  const root = options.root || ROOT;
  const home = options.home || os.homedir();
  const log = options.log || console.log;

  function must(label, command, args, extra) {
    const result = run(command, args, extra);
    if (result.status !== 0) throw new Error(label + ' failed.\n' + (result.stderr || result.stdout || '').trim());
    return (result.stdout || '').trim();
  }
  const clasp = (label, args, extra) => must(label, 'npx', ['--yes', CLASP, ...args], extra);
  const variable = (name, value) => must('Setting ' + name, 'gh', ['variable', 'set', name, '--body', value]);

  if (!/^[A-Za-z0-9_-]+$/.test(scriptId || '')) {
    throw new Error('Pass the Script ID from Apps Script Project Settings: npm run setup -- <SCRIPT_ID>');
  }
  must('GitHub login check (run "gh auth login" first)', 'gh', ['auth', 'status']);

  const credentials = path.join(home, '.clasprc.json');
  if (!fs.existsSync(credentials)) {
    log('No clasp login found. A browser window opens for Google sign-in.');
    clasp('Google sign-in', ['login'], { interactive: true });
  }

  const project = path.join(root, '.clasp.json');
  let id;
  try {
    must('Backend build', process.execPath, ['scripts/bundle-backend.js']);
    fs.writeFileSync(project, JSON.stringify(claspProject(scriptId), null, 2) + '\n');
    clasp('Pushing the backend (is the Apps Script API enabled?)', ['push', '--force']);

    // A stored deployment ID means the web app exists: update it so its address never changes.
    const existing = run('gh', ['variable', 'get', 'APPS_SCRIPT_DEPLOYMENT_ID']);
    id = existing.status === 0 ? existing.stdout.trim() : '';
    if (id) clasp('Updating the web app', ['deploy', '-i', id, '--description', 'Forms Platform web app']);
    else id = deploymentId(clasp('Creating the web app', ['deploy', '--description', 'Forms Platform web app']));
  } finally {
    fs.rmSync(project, { force: true });
  }

  const url = 'https://script.google.com/macros/s/' + id + '/exec';
  variable('APPS_SCRIPT_ID', scriptId);
  variable('APPS_SCRIPT_DEPLOYMENT_ID', id);
  variable('API_URL', url);
  // The credential goes through standard input so it never appears in a process list.
  must('Setting CLASPRC_JSON', 'gh', ['secret', 'set', 'CLASPRC_JSON'], { input: fs.readFileSync(credentials, 'utf8') });

  const pages = run('gh', ['api', PAGES, '--jq', '.build_type']);
  if (pages.status !== 0) must('Enabling GitHub Pages', 'gh', ['api', '-X', 'POST', PAGES, '-f', 'build_type=workflow']);
  else if (pages.stdout.trim() !== 'workflow') {
    must('Switching Pages to GitHub Actions', 'gh', ['api', '-X', 'PUT', PAGES, '-f', 'build_type=workflow']);
  }
  return { id, url };
}

if (require.main === module) {
  try {
    const { url } = setup(process.argv[2] || process.env.APPS_SCRIPT_ID);
    console.log([
      'Backend deployed and GitHub configured.',
      'Web app address: ' + url,
      'Next:',
      '  1. Reload the Forms Registry sheet, then Forms Platform > 1. First-time setup (allow permissions).',
      '  2. Forms Platform > 2. Set admin PIN...',
      '  3. git push origin master (or: gh workflow run pages.yml) to publish the website.'
    ].join('\n'));
  } catch (err) { console.error(err.message); process.exitCode = 1; }
}

module.exports = { CLASP, deploymentId, setup };
