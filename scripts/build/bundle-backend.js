#!/usr/bin/env node
/**
 * Bundles the Apps Script backend into one paste-ready file.
 *
 * Output (git-ignored):
 *   dist/Code.gs          shared rules + every backend/*.js module
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

function listBackend() {
  const dir = path.join(root, 'backend');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort((a, b) => (a === 'Code.js') - (b === 'Code.js') || a.localeCompare(b))
    .map((f) => path.posix.join('backend', f));
}

function bundleSource() {
  const files = [];
  if (fs.existsSync(path.join(root, 'domain', 'rules.js'))) files.push('domain/rules.js');
  if (fs.existsSync(path.join(root, 'domain', 'form-metadata.js'))) files.push('domain/form-metadata.js');
  files.push(...listBackend());

  const parts = files.map((rel) => `// ===== ${rel} =====\n${read(rel).trim()}\n`);
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
  if (fs.existsSync(manifest)) fs.copyFileSync(manifest, path.join(out, 'appsscript.json'));

  console.log(`Bundled ${files.length} files into dist/Code.gs (${code.length} chars).`);
}

if (require.main === module) bundle();

module.exports = { bundleSource };
