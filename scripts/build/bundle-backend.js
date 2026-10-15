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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** The order of the backend folders in the bundle; main.js comes last. */
const BACKEND_ORDER = ['platform/', 'features/'];

/**
 * Ranks a backend file for the bundle: platform code first, then the
 * features, then the files at the top of backend/, with main.js last.
 *
 * @param {string} file A path inside backend/, with forward slashes.
 * @return {number} The rank; lower comes first.
 */
function rankOf(file) {
  if (file === 'main.js') return BACKEND_ORDER.length + 1;
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

function bundleSource() {
  const files = [];
  if (fs.existsSync(path.join(root, 'domain', 'rules.js')))
    files.push('domain/rules.js');
  if (fs.existsSync(path.join(root, 'domain', 'form-metadata.js')))
    files.push('domain/form-metadata.js');
  files.push(...listBackend());

  const parts = files.map(
    (rel) => `// ===== ${rel} =====\n${read(rel).trim()}\n`
  );
  const code = parts.join('\n');

  // Fail loudly on syntax errors instead of discovering them in the editor.
  new vm.Script(code, { filename: 'Code.gs' });
  return { code, files };
}

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
