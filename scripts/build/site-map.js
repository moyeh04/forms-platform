/**
 * Where each published path of the site comes from. The site keeps the paths
 * it has always been served at, so a page a browser kept from an earlier
 * release still finds its scripts, while the sources live under `web/` and
 * `domain/`. The site packager, the preview server, the page tests and the
 * structure check all read this one map.
 */
const path = require('node:path');

/** The pages, published at the root of the site. */
const PAGES = ['index.html', 'admin.html', 'viewer.html'];

/** The source folder of the pages. */
const PAGE_SOURCE = 'web/';

/** Each published folder and the source folder it is copied from. */
const FOLDERS = [
  { published: 'assets/js/', source: 'web/js/' },
  { published: 'assets/css/', source: 'web/css/' },
  { published: 'assets/img/', source: 'web/img/' },
  { published: 'shared/', source: 'domain/' }
];

/**
 * The published scripts made by joining several sources in order. A page a
 * browser kept from before a script was split still asks for the old
 * address, so it stays for one release, made of the new parts.
 */
const JOINED = [
  {
    published: 'shared/rules.js',
    sources: [
      'domain/rules/text.js',
      'domain/rules/phone.js',
      'domain/rules/codes.js',
      'domain/rules/drive-link.js',
      'domain/rules/slots.js',
      'domain/rules/form.js',
      'domain/rules/team-size.js',
      'domain/rules/submission.js',
      'domain/rules/index.js'
    ]
  },
  {
    published: 'shared/form-metadata.js',
    sources: [
      'domain/form-metadata/read.js',
      'domain/form-metadata/subject.js',
      'domain/form-metadata/batch.js',
      'domain/form-metadata/index.js'
    ]
  }
];

/**
 * Finds the source file of a published path.
 *
 * @param {string} published A path of the site, with or without a leading
 *     `/`, a query or a fragment, such as `/assets/js/api.js?v=1`.
 * @return {?string} The source path from the repository root, or null when
 *     the path is not part of the site or leaves it.
 */
function sourceOf(published) {
  const bare = published.replace(/[?#].*$/, '');
  const clean = path.posix.normalize(`/${bare}`).replace(/^\/+/, '');
  if (PAGES.includes(clean)) return PAGE_SOURCE + clean;
  const folder = FOLDERS.find((entry) => clean.startsWith(entry.published));
  if (!folder) return null;
  return folder.source + clean.slice(folder.published.length);
}

module.exports = { PAGES, PAGE_SOURCE, FOLDERS, JOINED, sourceOf };
