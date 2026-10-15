/**
 * Checks where files live: only the allowed entries at the root, no
 * catch-all names such as `utils`, no folder with more code files than the
 * cap, every script and stylesheet a page loads exists and every one is
 * loaded, and FILE-STRUCTURE.md names every source file. A finding about a
 * folder names it with a trailing `/`. When the site is published at other
 * paths than its sources, the configured site map turns each `src` back into
 * its source path.
 */
const path = require('node:path');
const { select, read } = require('../lib/files.js');

const ASSET = /<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+\.(?:js|css))"/g;

/**
 * Makes one structure finding.
 *
 * @param {string} file The file or folder.
 * @param {string} rule The part of the rule, such as `root`.
 * @param {string} message What is wrong.
 * @param {number=} line The line, when the finding is inside a file.
 * @return {{file: string, line: number, rule: string, message: string}} The
 *     finding.
 */
function finding(file, rule, message, line = 0) {
  return { file, line, rule: `structure/${rule}`, message };
}

/**
 * Names a top-level entry the way a finding names it: a folder with `/`.
 *
 * @param {string} file A tracked path.
 * @return {string} Its first part, with `/` when it is a folder.
 */
function topOf(file) {
  const [first, ...rest] = file.split('/');
  return rest.length ? `${first}/` : first;
}

/**
 * Finds root entries that are not on the allow-list.
 *
 * @param {!Array<string>} files Every tracked file.
 * @param {!Array<string>} allowed The entries the root may hold.
 * @return {!Array<!Object>} One finding for each other entry.
 */
function rootFindings(files, allowed) {
  const tops = [...new Set(files.map(topOf))];
  return tops
    .filter((top) => !allowed.includes(top.replace(/\/$/, '')))
    .map((top) => finding(top, 'root', 'not allowed at the root'));
}

/**
 * Finds files and folders with a catch-all name.
 *
 * @param {!Array<string>} files Every tracked file.
 * @param {!Array<string>} names The names that say nothing.
 * @return {!Array<!Object>} One finding for each such file or folder.
 */
function nameFindings(files, names) {
  const found = new Set();
  for (const file of files) {
    const parts = file.split('/');
    parts.forEach((part, i) => {
      const stem = part.replace(/\..*$/, '');
      if (!names.includes(stem.toLowerCase())) return;
      const last = i === parts.length - 1;
      found.add(parts.slice(0, i + 1).join('/') + (last ? '' : '/'));
    });
  }
  return [...found].map((name) =>
    finding(name, 'name', 'a catch-all name; name it by what it does')
  );
}

/**
 * Finds folders that hold more code files than the cap.
 *
 * @param {!Array<string>} code The code files.
 * @param {number} cap The most code files a folder may hold.
 * @return {!Array<!Object>} One finding for each crowded folder.
 */
function capFindings(code, cap) {
  const counts = {};
  for (const file of code) {
    const dir = `${path.posix.dirname(file)}/`;
    counts[dir] = (counts[dir] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count > cap)
    .map(([dir, count]) =>
      finding(dir, 'cap', `${count} code files; sort them into sub-folders`)
    );
}

/**
 * Lists the scripts and stylesheets one page loads, with their lines.
 *
 * @param {string} page The page's path.
 * @param {string} html Its text.
 * @param {?function(string): ?string} sourceOf Turns a published path into
 *     its source path, or null when the site is served from its sources.
 * @return {!Array<{src: string, file: ?string, line: number}>} Each `src`,
 *     its source path from the root, and its line.
 */
function pageAssets(page, html, sourceOf) {
  return [...html.matchAll(ASSET)]
    .filter((match) => !/^[a-z]+:|^\/\//.test(match[1]))
    .map((match) => ({
      src: match[1],
      file: sourceOf
        ? sourceOf(match[1])
        : path.posix.join(path.posix.dirname(page), match[1]),
      line: html.slice(0, match.index).split('\n').length
    }));
}

/**
 * Finds page assets that do not exist, and scripts no page loads.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The `structure` part of the configuration.
 * @return {!Array<!Object>} One finding for each.
 */
function pageFindings(root, files, config) {
  const sourceOf = config.siteMap
    ? require(path.join(root, config.siteMap)).sourceOf
    : null;
  const loaded = new Set();
  const out = [];
  for (const page of config.pages) {
    for (const asset of pageAssets(page, read(root, page), sourceOf)) {
      loaded.add(asset.file);
      if (files.includes(asset.file)) continue;
      const message = `loads ${asset.src}, which does not exist`;
      out.push(finding(page, 'pages', message, asset.line));
    }
  }
  for (const file of select(files, config.loaded)) {
    if (loaded.has(file)) continue;
    out.push(finding(file, 'pages', 'no page loads it'));
  }
  return out;
}

/**
 * Finds source files FILE-STRUCTURE.md does not name, by path or by name.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The `structure` part of the configuration.
 * @return {!Array<!Object>} One finding for each file left out.
 */
function documentedFindings(root, files, config) {
  const doc = read(root, config.fileStructure);
  return select(files, config.documented)
    .filter((file) => {
      const name = path.posix.basename(file);
      return !doc.includes(`\`${file}\``) && !doc.includes(`\`${name}\``);
    })
    .map((file) =>
      finding(file, 'documented', `${config.fileStructure} does not name it`)
    );
}

/**
 * Checks the structure of the whole tree.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} What is wrong.
 */
function check(root, files, config) {
  const rules = config.structure;
  return [
    ...rootFindings(files, rules.root),
    ...nameFindings(files, rules.catchAllNames),
    ...capFindings(select(files, rules.code), rules.cap),
    ...pageFindings(root, files, rules),
    ...documentedFindings(root, files, rules)
  ];
}

module.exports = { check, wholeTree: true };
