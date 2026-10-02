#!/usr/bin/env node
/** Validate deployment settings and create ignored clasp configuration. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { apiUrl } = require('./build-site.js');

function deploymentConfig(env) {
  for (const key of ['APPS_SCRIPT_ID', 'APPS_SCRIPT_DEPLOYMENT_ID']) {
    if (!/^[A-Za-z0-9_-]+$/.test(env[key] || '')) {
      throw new Error(key + ' must be set in GitHub repository Variables.');
    }
  }
  apiUrl(env);
  let credentials;
  try { credentials = JSON.parse(env.CLASPRC_JSON || ''); } catch (_) {
    throw new Error('CLASPRC_JSON must contain the entire valid JSON credentials file, including braces.');
  }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials) || !Object.keys(credentials).length) {
    throw new Error('CLASPRC_JSON must contain a nonempty JSON credentials object.');
  }
  return { project: { scriptId: env.APPS_SCRIPT_ID, rootDir: './dist' }, credentials };
}

function prepareClasp(env = process.env, root = path.resolve(__dirname, '..'), home = os.homedir()) {
  const config = deploymentConfig(env);
  fs.writeFileSync(path.join(root, '.clasp.json'), JSON.stringify(config.project, null, 2) + '\n');
  fs.writeFileSync(path.join(home, '.clasprc.json'), JSON.stringify(config.credentials) + '\n', { mode: 0o600 });
}

if (require.main === module) {
  try { prepareClasp(); console.log('Clasp configuration prepared.'); }
  catch (err) { console.error(err.message); process.exitCode = 1; }
}

module.exports = { deploymentConfig, prepareClasp };
