#!/usr/bin/env node
/** First deployment from a workstation: create the sheet, push the backend, create the web app, configure GitHub. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { claspProject } = require('./prepare-clasp.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CLASP = '@google/clasp@3.4.1'; // Same pinned version as .github/workflows/pages.yml.
const PAGES = 'repos/{owner}/{repo}/pages';
const SHEET = 'Forms Registry';

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    input: options.input,
    stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe']
  });
}

/** clasp prints "Deployed <id> @<version>"; the ID is the only long token before the version. */
function deploymentId(output) {
  const match = /([A-Za-z0-9_-]{20,})\s+@\d+/.exec(output || '');
  if (!match)
    throw new Error(
      'clasp did not report a deployment ID. Its output was:\n' +
        (output || '(empty)')
    );
  return match[1];
}

/** Ask one question on the terminal and return the trimmed answer. */
function ask(question) {
  process.stdout.write(question);
  const buffer = Buffer.alloc(1024);
  for (;;) {
    try {
      return buffer
        .toString('utf8', 0, fs.readSync(0, buffer, 0, buffer.length))
        .trim();
    } catch (err) {
      if (err.code !== 'EAGAIN') throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); // Terminal not ready yet.
    }
  }
}

/** New sheet (the default) or an existing one; returns the existing Script ID or '' for a new sheet. */
function chooseSheet(prompt, log) {
  log(
    [
      'This repository has no Google Sheet yet.',
      '  1 = Make a new sheet with the name "' + SHEET + '" (recommended).',
      '  2 = Use a sheet that you have now.',
      'Type 1 or 2. Then press Enter.',
      'If you press Enter only, the answer is 1.'
    ].join('\n')
  );
  const choice = prompt('Your answer: ');
  if (choice === '' || choice === '1') return '';
  if (choice !== '2')
    throw new Error(
      'The answer must be 1 or 2. Nothing was created. Start the setup again.'
    );
  log(
    [
      'Type the Script ID of your sheet. Then press Enter.',
      'To find the Script ID: open the sheet, click Extensions > Apps Script, then click Project Settings.',
      'If you do not have the Script ID now, press Enter only. The setup stops and makes nothing.'
    ].join('\n')
  );
  const id = prompt('Script ID: ');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(
      'The Script ID is missing or incorrect. Nothing was created. ' +
        'When you have the Script ID, run this command: npm run setup -- <SCRIPT_ID>'
    );
  }
  return id;
}

/** `clasp create --json` prints one object; anything around it is progress text. */
function createdProject(output) {
  const text = output || '';
  let created = {};
  try {
    created = JSON.parse(
      text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    );
  } catch (_) {
    /* reported below */
  }
  if (!/^[A-Za-z0-9_-]+$/.test(created.scriptId || '')) {
    throw new Error(
      'clasp did not report a Script ID. Its output was:\n' +
        (text || '(empty)')
    );
  }
  return {
    scriptId: created.scriptId,
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/' + created.parentId + '/edit'
  };
}

function setup(scriptId, options = {}) {
  const run = options.run || execute;
  const root = options.root || ROOT;
  const home = options.home || os.homedir();
  const log = options.log || console.log;

  function must(label, command, args, extra) {
    const result = run(command, args, extra);
    if (result.status !== 0)
      throw new Error(
        label + ' failed.\n' + (result.stderr || result.stdout || '').trim()
      );
    return (result.stdout || '').trim();
  }
  const clasp = (label, args, extra) =>
    must(label, 'npx', ['--yes', CLASP, ...args], extra);
  const variable = (name, value) =>
    must('Setting ' + name, 'gh', ['variable', 'set', name, '--body', value]);

  if (scriptId && !/^[A-Za-z0-9_-]+$/.test(scriptId)) {
    throw new Error(
      'That is not a Script ID. Copy it from Apps Script Project Settings, or pass none to create a new sheet.'
    );
  }
  must('GitHub login check (run "gh auth login" first)', 'gh', [
    'auth',
    'status'
  ]);

  const credentials = path.join(home, '.clasprc.json');
  if (!fs.existsSync(credentials)) {
    log('No clasp login found. A browser window opens for Google sign-in.');
    clasp('Google sign-in', ['login'], { interactive: true });
  }

  // A stored Script ID means the sheet exists; creating another one would orphan its data.
  if (!scriptId) {
    const stored = run('gh', ['variable', 'get', 'APPS_SCRIPT_ID']);
    scriptId = stored.status === 0 ? stored.stdout.trim() : '';
  }
  // Asked only on a terminal; an unattended run takes the recommended choice.
  if (!scriptId && options.ask) scriptId = chooseSheet(options.ask, log);
  let sheetUrl = '';
  if (!scriptId) {
    // clasp also clones the empty project into its working folder, so it runs in a scratch one.
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'forms-setup-'));
    try {
      const output = clasp(
        'Creating the ' +
          SHEET +
          ' sheet (turn on the Apps Script API at ' +
          'https://script.google.com/home/usersettings; if a sheet without a script was left in Drive, delete it)',
        ['create', '--type', 'sheets', '--title', SHEET, '--json'],
        { cwd: scratch }
      );
      ({ scriptId, sheetUrl } = createdProject(output));
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    // Stored at once, so a later failure cannot lead to a second sheet on the next run.
    variable('APPS_SCRIPT_ID', scriptId);
  }

  const project = path.join(root, '.clasp.json');
  let id;
  try {
    must('Backend build', process.execPath, [
      'scripts/build/bundle-backend.js'
    ]);
    fs.writeFileSync(
      project,
      JSON.stringify(claspProject(scriptId), null, 2) + '\n'
    );
    clasp('Pushing the backend (is the Apps Script API enabled?)', [
      'push',
      '--force'
    ]);

    // A stored deployment ID means the web app exists: update it so its address never changes.
    const existing = run('gh', [
      'variable',
      'get',
      'APPS_SCRIPT_DEPLOYMENT_ID'
    ]);
    id = existing.status === 0 ? existing.stdout.trim() : '';
    if (id)
      clasp('Updating the web app', [
        'deploy',
        '-i',
        id,
        '--description',
        'Forms Platform web app'
      ]);
    else
      id = deploymentId(
        clasp('Creating the web app', [
          'deploy',
          '--description',
          'Forms Platform web app'
        ])
      );
  } finally {
    fs.rmSync(project, { force: true });
  }

  const url = 'https://script.google.com/macros/s/' + id + '/exec';
  variable('APPS_SCRIPT_ID', scriptId);
  variable('APPS_SCRIPT_DEPLOYMENT_ID', id);
  variable('API_URL', url);
  // The credential goes through standard input so it never appears in a process list.
  must('Setting CLASPRC_JSON', 'gh', ['secret', 'set', 'CLASPRC_JSON'], {
    input: fs.readFileSync(credentials, 'utf8')
  });

  const pages = run('gh', ['api', PAGES, '--jq', '.build_type']);
  if (pages.status !== 0)
    must('Enabling GitHub Pages', 'gh', [
      'api',
      '-X',
      'POST',
      PAGES,
      '-f',
      'build_type=workflow'
    ]);
  else if (pages.stdout.trim() !== 'workflow') {
    must('Switching Pages to GitHub Actions', 'gh', [
      'api',
      '-X',
      'PUT',
      PAGES,
      '-f',
      'build_type=workflow'
    ]);
  }
  return { id, url, scriptId, sheetUrl };
}

if (require.main === module) {
  try {
    const { url, sheetUrl } = setup(
      process.argv[2] || process.env.APPS_SCRIPT_ID,
      { ask: process.stdin.isTTY ? ask : undefined }
    );
    console.log(
      [
        'Backend deployed and GitHub configured.',
        'Web app address: ' + url,
        sheetUrl
          ? 'New sheet: ' + sheetUrl
          : 'Sheet: the one that owns this script (unchanged).',
        'Next:',
        '  1. Open or reload the ' +
          SHEET +
          ' sheet, then Forms Platform > 1. First-time setup (allow permissions).',
        '  2. Forms Platform > 2. Set admin PIN...',
        '  3. git push origin master (or: gh workflow run pages.yml) to publish the website.'
      ].join('\n')
    );
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = { CLASP, createdProject, deploymentId, setup };
