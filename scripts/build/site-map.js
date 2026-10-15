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
 * browser kept from before a script was moved or split still asks for the
 * old address, so it stays for one release, made of the new file or parts.
 * The old rules come with the enums they read, which those pages never
 * loaded.
 */
const JOINED = [
  { published: 'assets/js/fresh.js', sources: ['web/js/app/fresh.js'] },
  { published: 'assets/js/api.js', sources: ['web/js/app/api.js'] },
  { published: 'assets/js/theme.js', sources: ['web/js/app/theme.js'] },
  {
    published: 'assets/js/i18n.js',
    sources: ['web/js/i18n/en.js', 'web/js/i18n/ar.js', 'web/js/i18n/i18n.js']
  },
  {
    published: 'assets/js/ui.js',
    sources: [
      'web/js/ui/dom.js',
      'web/js/ui/icons.js',
      'web/js/ui/dialogs.js',
      'web/js/ui/clipboard.js',
      'web/js/ui/theme-button.js'
    ]
  },
  {
    published: 'assets/js/handover.js',
    sources: ['web/js/teams/handover.view.js']
  },
  {
    published: 'assets/js/form.js',
    sources: [
      'web/js/form/form.model.js',
      'web/js/form/steps.model.js',
      'web/js/form/drafts.model.js',
      'web/js/form/chrome.view.js',
      'web/js/form/route.view.js',
      'web/js/form/fields.view.js',
      'web/js/form/text-input.view.js',
      'web/js/form/select.view.js',
      'web/js/form/team-size.view.js',
      'web/js/form/members.view.js',
      'web/js/form/slots.view.js',
      'web/js/form/review.view.js',
      'web/js/form/form.view.js',
      'web/js/form/team-key.page.js',
      'web/js/form/navigation.page.js',
      'web/js/form/submit.page.js',
      'web/js/form/submit-errors.page.js',
      'web/js/form/key-entry.page.js',
      'web/js/form/edit.page.js',
      'web/js/form/success.view.js',
      'web/js/form/contacts.view.js',
      'web/js/form/transfer.view.js',
      'web/js/form/transfer.page.js',
      'web/js/form/form.page.js'
    ]
  },
  {
    published: 'assets/js/ticket.js',
    sources: [
      'web/js/form/ticket/time.model.js',
      'web/js/form/ticket/shapes.view.js',
      'web/js/form/ticket/calendar.view.js',
      'web/js/form/ticket/clock-hands.view.js',
      'web/js/form/ticket/clock.view.js',
      'web/js/form/ticket/when.view.js',
      'web/js/form/ticket/save-image.page.js',
      'web/js/form/ticket/ticket.view.js'
    ]
  },
  {
    published: 'assets/js/size-alerts.js',
    sources: ['web/js/teams/size-alerts.view.js']
  },
  {
    published: 'shared/rules.js',
    sources: [
      'domain/enums.js',
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
  },
  {
    published: 'assets/js/admin.js',
    sources: ['web/js/admin/shell/admin.page.js']
  },
  {
    published: 'assets/js/admin-timetable.js',
    sources: ['web/js/admin/settings/timetable.view.js']
  },
  {
    published: 'assets/js/admin-keys.js',
    sources: ['web/js/admin/keys/keys.view.js']
  },
  {
    published: 'assets/js/admin-range.js',
    sources: ['web/js/admin/settings/range.view.js']
  },
  {
    published: 'assets/js/admin-size-alerts.js',
    sources: ['web/js/admin/settings/size-alerts.view.js']
  },
  {
    published: 'assets/js/admin-settings.js',
    sources: ['web/js/admin/settings/settings.page.js']
  },
  {
    published: 'assets/js/admin-data.js',
    sources: ['web/js/admin/responses/responses.page.js']
  },
  {
    published: 'assets/js/admin-download.js',
    sources: ['web/js/admin/responses/download.view.js']
  },
  {
    published: 'assets/js/admin-people.js',
    sources: ['web/js/admin/people/people.page.js']
  },
  {
    published: 'assets/js/admin-lists.js',
    sources: ['web/js/admin/lists/lists.page.js']
  }
];

/**
 * Finds the source file of a published path.
 *
 * @param {string} published A path of the site, with or without a leading
 *     `/`, a query or a fragment, such as `/assets/js/app/api.js?v=1`.
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
