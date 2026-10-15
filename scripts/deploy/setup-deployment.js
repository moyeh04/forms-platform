#!/usr/bin/env node
/**
 * First deployment from a workstation: create the sheet, push the backend,
 * create the web app, configure GitHub.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { claspProject } = require('./prepare-clasp.js');
const {
  ID_PATTERN,
  createdProject,
  deploymentId
} = require('./clasp-output.js');

const ROOT = path.resolve(__dirname, '..', '..');
// Same pinned version as .github/workflows/pages.yml.
const CLASP = '@google/clasp@3.4.1';
const PAGES = 'repos/{owner}/{repo}/pages';
const SHEET = 'Forms Registry';
const WEB_APP = 'Forms Platform web app';

/** How many bytes of a terminal answer are read at once. */
const ANSWER_BYTES = 1024;

/** How long to wait for a terminal that is not ready, in milliseconds. */
const TERMINAL_RETRY_MS = 50;

/**
 * Runs a command.
 *
 * @param {string} command The program.
 * @param {!Array<string>} args Its arguments.
 * @param {{cwd: (string|undefined), input: (string|undefined),
 *     interactive: (boolean|undefined)}=} options Where it runs, what it
 *     reads, and whether it uses the terminal.
 * @return {!Object} What spawnSync returns.
 */
function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    input: options.input,
    stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe']
  });
}

/**
 * Asks one question on the terminal.
 *
 * @param {string} question The question.
 * @return {string} The trimmed answer.
 */
function ask(question) {
  process.stdout.write(question);
  const buffer = Buffer.alloc(ANSWER_BYTES);
  for (;;) {
    try {
      return buffer
        .toString('utf8', 0, fs.readSync(0, buffer, 0, buffer.length))
        .trim();
    } catch (err) {
      if (err.code !== 'EAGAIN') throw err;
      // Terminal not ready yet.
      const cell = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
      Atomics.wait(new Int32Array(cell), 0, 0, TERMINAL_RETRY_MS);
    }
  }
}

/**
 * Asks whether to make a new sheet (the default) or use an existing one.
 *
 * @param {function(string): string} prompt Asks a question.
 * @param {function(string)} log Prints a message.
 * @return {string} The Script ID of the existing sheet, or '' for a new one.
 * @throws {Error} When the answer or the Script ID is wrong.
 */
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
      'To find the Script ID: open the sheet, click Extensions > Apps' +
        ' Script, then click Project Settings.',
      'If you do not have the Script ID now, press Enter only. The setup' +
        ' stops and makes nothing.'
    ].join('\n')
  );
  const id = prompt('Script ID: ');
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      'The Script ID is missing or incorrect. Nothing was created. ' +
        'When you have the Script ID, run this command:' +
        ' npm run setup -- <SCRIPT_ID>'
    );
  }
  return id;
}

/**
 * Runs a command and stops the setup when it fails.
 *
 * @param {!Object} ctx The setup: how it runs commands.
 * @param {string} label What the command does, for the error.
 * @param {!Array<string>} argv The program and its arguments.
 * @param {!Object=} extra Options of the command.
 * @return {string} What it printed, trimmed.
 * @throws {Error} When it fails.
 */
function must(ctx, label, argv, extra) {
  const result = ctx.run(argv[0], argv.slice(1), extra);
  if (result.status !== 0)
    throw new Error(
      label + ' failed.\n' + (result.stderr || result.stdout || '').trim()
    );
  return (result.stdout || '').trim();
}

/**
 * Runs clasp at the pinned version and stops the setup when it fails.
 *
 * @param {!Object} ctx The setup.
 * @param {string} label What the command does, for the error.
 * @param {!Array<string>} args The arguments of clasp.
 * @param {!Object=} extra Options of the command.
 * @return {string} What it printed, trimmed.
 */
function clasp(ctx, label, args, extra) {
  return must(ctx, label, ['npx', '--yes', CLASP, ...args], extra);
}

/**
 * Stores a GitHub repository variable.
 *
 * @param {!Object} ctx The setup.
 * @param {string} name The variable.
 * @param {string} value Its value.
 */
function variable(ctx, name, value) {
  must(ctx, 'Setting ' + name, [
    'gh',
    'variable',
    'set',
    name,
    '--body',
    value
  ]);
}

/**
 * Reads a GitHub repository variable.
 *
 * @param {!Object} ctx The setup.
 * @param {string} name The variable.
 * @return {string} Its value, or '' when it is not set.
 */
function storedVariable(ctx, name) {
  const stored = ctx.run('gh', ['variable', 'get', name]);
  return stored.status === 0 ? stored.stdout.trim() : '';
}

/**
 * Checks the GitHub login and signs in to Google when clasp has no login.
 *
 * @param {!Object} ctx The setup.
 * @return {string} The path of the clasp credentials.
 */
function signIn(ctx) {
  must(ctx, 'GitHub login check (run "gh auth login" first)', [
    'gh',
    'auth',
    'status'
  ]);
  const credentials = path.join(ctx.home, '.clasprc.json');
  if (!fs.existsSync(credentials)) {
    ctx.log('No clasp login found. A browser window opens for Google sign-in.');
    clasp(ctx, 'Google sign-in', ['login'], { interactive: true });
  }
  return credentials;
}

/**
 * Makes a new sheet with its script and stores its Script ID at once, so a
 * later failure cannot lead to a second sheet on the next run.
 *
 * @param {!Object} ctx The setup.
 * @return {{scriptId: string, sheetUrl: string}} The new sheet.
 */
function createSheet(ctx) {
  // clasp also clones the empty project into its working folder, so it runs
  // in a scratch one.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'forms-setup-'));
  let created;
  try {
    const output = clasp(
      ctx,
      'Creating the ' +
        SHEET +
        ' sheet (turn on the Apps Script API at ' +
        'https://script.google.com/home/usersettings; if a sheet without a' +
        ' script was left in Drive, delete it)',
      ['create', '--type', 'sheets', '--title', SHEET, '--json'],
      { cwd: scratch }
    );
    created = createdProject(output);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  variable(ctx, 'APPS_SCRIPT_ID', created.scriptId);
  return created;
}

/**
 * Finds the sheet to deploy to: the one given, the one stored in GitHub,
 * the one the person names, or a new one.
 *
 * @param {!Object} ctx The setup.
 * @param {string|undefined} scriptId The Script ID given to the setup.
 * @return {{scriptId: string, sheetUrl: string}} The sheet; sheetUrl is set
 *     only for a new one.
 */
function findSheet(ctx, scriptId) {
  // A stored Script ID means the sheet exists; creating another one would
  // orphan its data.
  let id = scriptId || storedVariable(ctx, 'APPS_SCRIPT_ID');
  // Asked only on a terminal; an unattended run takes the recommended
  // choice.
  if (!id && ctx.ask) id = chooseSheet(ctx.ask, ctx.log);
  if (id) return { scriptId: id, sheetUrl: '' };
  return createSheet(ctx);
}

/**
 * Updates the web app when GitHub stores its deployment ID, so its address
 * never changes, or creates it.
 *
 * @param {!Object} ctx The setup.
 * @return {string} The deployment ID.
 */
function deployWebApp(ctx) {
  const id = storedVariable(ctx, 'APPS_SCRIPT_DEPLOYMENT_ID');
  if (id) {
    clasp(ctx, 'Updating the web app', [
      'deploy',
      '-i',
      id,
      '--description',
      WEB_APP
    ]);
    return id;
  }
  return deploymentId(
    clasp(ctx, 'Creating the web app', ['deploy', '--description', WEB_APP])
  );
}

/**
 * Builds the backend, pushes it to the sheet's script and deploys the web
 * app. The clasp project file exists only while clasp needs it.
 *
 * @param {!Object} ctx The setup.
 * @param {string} scriptId The Script ID.
 * @return {string} The deployment ID.
 */
function pushBackend(ctx, scriptId) {
  const project = path.join(ctx.root, '.clasp.json');
  try {
    must(ctx, 'Backend build', [
      process.execPath,
      'scripts/build/bundle-backend.js'
    ]);
    fs.writeFileSync(
      project,
      JSON.stringify(claspProject(scriptId), null, 2) + '\n'
    );
    clasp(ctx, 'Pushing the backend (is the Apps Script API enabled?)', [
      'push',
      '--force'
    ]);
    return deployWebApp(ctx);
  } finally {
    fs.rmSync(project, { force: true });
  }
}

/**
 * Turns on GitHub Pages, or switches it, so the workflow publishes the
 * site.
 *
 * @param {!Object} ctx The setup.
 */
function usePagesWorkflow(ctx) {
  const pages = ctx.run('gh', ['api', PAGES, '--jq', '.build_type']);
  const method = pages.status !== 0 ? 'POST' : 'PUT';
  if (method === 'PUT' && pages.stdout.trim() === 'workflow') return;
  must(
    ctx,
    method === 'POST'
      ? 'Enabling GitHub Pages'
      : 'Switching Pages to GitHub Actions',
    ['gh', 'api', '-X', method, PAGES, '-f', 'build_type=workflow']
  );
}

/**
 * Runs the first deployment.
 *
 * @param {string|undefined} scriptId The Script ID of an existing sheet, or
 *     none to find or make one.
 * @param {{run: (function|undefined), root: (string|undefined),
 *     home: (string|undefined), log: (function(string)|undefined),
 *     ask: (function(string): string|undefined)}=} options How it runs
 *     commands, where, and how it talks to the person.
 * @return {{id: string, url: string, scriptId: string, sheetUrl: string}}
 *     The deployment, the web app address and the sheet.
 * @throws {Error} When a step fails.
 */
function setup(scriptId, options = {}) {
  const ctx = {
    run: options.run || execute,
    root: options.root || ROOT,
    home: options.home || os.homedir(),
    log: options.log || console.log,
    ask: options.ask
  };
  if (scriptId && !ID_PATTERN.test(scriptId)) {
    throw new Error(
      'That is not a Script ID. Copy it from Apps Script Project Settings,' +
        ' or pass none to create a new sheet.'
    );
  }
  const credentials = signIn(ctx);
  const sheet = findSheet(ctx, scriptId);
  const id = pushBackend(ctx, sheet.scriptId);
  const url = 'https://script.google.com/macros/s/' + id + '/exec';
  variable(ctx, 'APPS_SCRIPT_ID', sheet.scriptId);
  variable(ctx, 'APPS_SCRIPT_DEPLOYMENT_ID', id);
  variable(ctx, 'API_URL', url);
  // The credential goes through standard input so it never appears in a
  // process list.
  must(ctx, 'Setting CLASPRC_JSON', ['gh', 'secret', 'set', 'CLASPRC_JSON'], {
    input: fs.readFileSync(credentials, 'utf8')
  });
  usePagesWorkflow(ctx);
  return { id, url, scriptId: sheet.scriptId, sheetUrl: sheet.sheetUrl };
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
          ' sheet, then Forms Platform > 1. First-time setup (allow' +
          ' permissions).',
        '  2. Forms Platform > 2. Set admin PIN...',
        '  3. git push origin master (or: gh workflow run pages.yml) to' +
          ' publish the website.'
      ].join('\n')
    );
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = { CLASP, setup };
