/**
 * The name of the app, the registry tab names, and the names of the script
 * properties and cache keys.
 */

var Constants = (function () {
  var APP = { name: 'Forms Platform', version: '1.0.0' };

  var TABS = { forms: 'Forms', clients: 'Clients', lists: 'Lists' };

  /** The names of the script properties. A prefix is followed by an id. */
  var PROPS = Object.freeze({
    ADMIN_PIN_HASH: 'ADMIN_PIN_HASH',
    PEPPER: 'PEPPER',
    REGISTRY_ID: 'REGISTRY_ID',
    ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
    SITE_URL: 'SITE_URL',
    /** Followed by a form id: when the form's sheet views went out of date. */
    DIRTY_PREFIX: 'dirty:'
  });

  /** The keys of the script cache. A prefix is followed by an id. */
  var CACHE = Object.freeze({
    ADMIN_FAILS: 'admin_fails',
    BAD_TOKENS: 'bad_tokens',
    VIEWS_BOOKED: 'views_booked',
    /** Followed by a link id: the wrong access keys of the link. */
    CLIENT_KEY_PREFIX: 'client_key:',
    /** Followed by a form id: the wrong edit keys of the form. */
    BAD_KEY_PREFIX: 'badkey:',
    /** Followed by a job id: the saved state of a download. */
    DL_JOB_PREFIX: 'dl_job:'
  });

  return { APP, TABS, PROPS, CACHE };
})();
