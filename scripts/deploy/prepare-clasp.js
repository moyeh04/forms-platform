#!/usr/bin/env node
/** Validate deployment settings and create ignored clasp configuration. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { apiUrl } = require('../build/build-site.js');

/** Only the owner may read or write the credentials file. */
const OWNER_ONLY = 0o600;

/**
 * Builds the clasp project settings.
 *
 * @param {string} scriptId The id of the Apps Script project.
 * @return {{scriptId: string, rootDir: string}} The settings.
 */
function claspProject(scriptId) {
  return { scriptId, rootDir: './dist' };
}

/**
 * Checks the deployment settings and reads the clasp credentials.
 *
 * @param {!Object<string, string>} env The environment of the run.
 * @return {{project: !Object, credentials: !Object}} The project settings
 *     and the credentials.
 * @throws {Error} When a setting is missing or wrong.
 */
function deploymentConfig(env) {
  for (const key of ['APPS_SCRIPT_ID', 'APPS_SCRIPT_DEPLOYMENT_ID']) {
    if (!/^[A-Za-z0-9_-]+$/.test(env[key] || '')) {
      throw new Error(key + ' must be set in GitHub repository Variables.');
    }
  }
  apiUrl(env);
  let credentials;
  try {
    credentials = JSON.parse(env.CLASPRC_JSON || '');
  } catch (_) {
    throw new Error(
      'CLASPRC_JSON must contain the entire valid JSON credentials file,' +
        ' including braces.'
    );
  }
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials) ||
    !Object.keys(credentials).length
  ) {
    throw new Error(
      'CLASPRC_JSON must contain a nonempty JSON credentials object.'
    );
  }
  return { project: claspProject(env.APPS_SCRIPT_ID), credentials };
}

/**
 * Writes the clasp project file and the credentials file.
 *
 * @param {!Object<string, string>} env The environment of the run.
 * @param {string} root The repository root.
 * @param {string} home The home folder, where clasp reads its credentials.
 */
function prepareClasp(
  env = process.env,
  root = path.resolve(__dirname, '..', '..'),
  home = os.homedir()
) {
  const config = deploymentConfig(env);
  fs.writeFileSync(
    path.join(root, '.clasp.json'),
    JSON.stringify(config.project, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(home, '.clasprc.json'),
    JSON.stringify(config.credentials) + '\n',
    { mode: OWNER_ONLY }
  );
}

if (require.main === module) {
  try {
    prepareClasp();
    console.log('Clasp configuration prepared.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = { claspProject, deploymentConfig, prepareClasp };
