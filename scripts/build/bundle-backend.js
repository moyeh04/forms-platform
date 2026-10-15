#!/usr/bin/env node
/**
 * Bundles the Apps Script backend into one paste-ready file.
 *
 * Output (git-ignored):
 *   dist/Code.gs          the domain rules + every .js file under backend/
 *   dist/appsscript.json  the manifest (time zone, scopes, web app settings)
 *
 * Module load order does not matter: every module only declares functions
 * or attaches handlers to the shared API table (`var API = API || {}`).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'dist');

/**
 * Reads a file of the repository.
 *
 * @param {string} rel Its path from the repository root.
 * @return {string} Its text.
 */
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** The order of the backend folders in the bundle. */
const BACKEND_ORDER = ['platform/', 'features/'];

/**
 * The files at the top of backend/ that come after every folder, in order:
 * the action table and the Apps Script entry points need the namespaces of
 * the folders, and main.js reads best at the end.
 */
const BACKEND_LAST = ['routes.js', 'entry-points.js', 'main.js'];

/**
 * The domain files, which the browser loads too, in the order they come
 * before the backend: the enums first, since the others read them, and each
 * part of the rules and of the form metadata after the parts it reads.
 */
const DOMAIN_FIRST = [
  'domain/enums.js',
  'domain/rules/text.js',
  'domain/rules/phone.js',
  'domain/rules/codes.js',
  'domain/rules/drive-link.js',
  'domain/rules/slots.js',
  'domain/rules/form.js',
  'domain/rules/team-size.js',
  'domain/rules/progress.js',
  'domain/rules/progress-marks.js',
  'domain/rules/submission.js',
  'domain/rules/index.js',
  'domain/form-metadata/read.js',
  'domain/form-metadata/subject.js',
  'domain/form-metadata/batch.js',
  'domain/form-metadata/index.js'
];

/**
 * Ranks a backend file for the bundle: platform code first, then the
 * features, then any other file at the top of backend/, then the action
 * table, the entry points and main.js.
 *
 * @param {string} file A path inside backend/, with forward slashes.
 * @return {number} The rank; lower comes first.
 */
function rankOf(file) {
  const last = BACKEND_LAST.indexOf(file);
  if (last !== -1) return BACKEND_ORDER.length + 1 + last;
  const index = BACKEND_ORDER.findIndex((dir) => file.startsWith(dir));
  return index === -1 ? BACKEND_ORDER.length : index;
}

/**
 * Lists every backend source file, in bundle order.
 *
 * @return {!Array<string>} Paths from the repository root.
 */
function listBackend() {
  const dir = path.join(root, 'backend');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => f.endsWith('.js'))
    .sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))
    .map((f) => path.posix.join('backend', f));
}

/**
 * Joins the domain files and the backend files into one script, and
 * refuses it when it does not parse.
 *
 * @return {{code: string, files: !Array<string>}} The script and the files
 *     it holds, in order.
 */
function bundleSource() {
  const files = DOMAIN_FIRST.filter((f) => fs.existsSync(path.join(root, f)));
  files.push(...listBackend());

  const parts = files.map(
    (rel) => `// ===== ${rel} =====\n${read(rel).trim()}\n`
  );
  const code = parts.join('\n');

  // Fail loudly on syntax errors instead of discovering them in the editor.
  new vm.Script(code, { filename: 'Code.gs' });
  return { code, files };
}

/** Writes the bundle and the manifest into dist/. */
function bundle() {
  const { code, files } = bundleSource();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'Code.gs'), code);
  const manifest = path.join(root, 'backend', 'appsscript.json');
  if (fs.existsSync(manifest))
    fs.copyFileSync(manifest, path.join(out, 'appsscript.json'));

  console.log(
    `Bundled ${files.length} files into dist/Code.gs (${code.length} chars).`
  );
}

if (require.main === module) bundle();

module.exports = { bundleSource };
