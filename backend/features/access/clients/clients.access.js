/**
 * Who may use a link: its token, its key, its end date and the lock-out after
 * wrong keys.
 */

var ClientsAccess = (function () {
  /** How many wrong keys a link takes before it waits. */
  var CLIENT_KEY_TRIES_ = 5;

  /** How many unknown tokens the script takes before every link waits. */
  var TOKEN_TRIES_ = 30;

  /** How long the count of unknown tokens lasts, in seconds. */
  var TOKEN_WINDOW_S_ = 60;

  /** How long the count of wrong keys of a link lasts, in seconds. */
  var KEY_WINDOW_S_ = 600;

  /** The length of a date at the start of an ISO instant: `yyyy-MM-dd`. */
  var ISO_DATE_LENGTH_ = 10;

  /**
   * Finds the link a token opens. Unknown tokens are throttled.
   *
   * @param {!Object} cache The script cache.
   * @param {*} token The token of the link.
   * @return {!Object} The link.
   * @throws {ApiError} `too_many_attempts` or `bad_token`.
   */
  function linkByToken_(cache, token) {
    var fails = parseInt(cache.get(Constants.CACHE.BAD_TOKENS) || '0', 10);
    if (fails >= TOKEN_TRIES_)
      ApiError.fail(
        'too_many_attempts',
        'Too many tries. Wait a minute and open the link again.'
      );
    var h = token ? ClientsService.clientToken(token) : '';
    var hit = null;
    ClientsRepository.readClients().forEach(function (c) {
      if (h && c.tokenHash === h) hit = c;
    });
    if (!hit) {
      cache.put(Constants.CACHE.BAD_TOKENS, String(fails + 1), TOKEN_WINDOW_S_);
      ApiError.fail('bad_token', 'This link is not valid.');
    }
    return hit;
  }

  /**
   * Checks the access key of a link that asks for one. Wrong keys lock the
   * link for a while.
   *
   * @param {!Object} cache The script cache.
   * @param {!Object} link The link.
   * @param {*} accessKey The key as sent.
   * @throws {ApiError} `key_locked`, `key_needed` or `bad_access_key`.
   */
  function checkAccessKey_(cache, link, accessKey) {
    var tag = Constants.CACHE.CLIENT_KEY_PREFIX + link.id;
    var wrong = parseInt(cache.get(tag) || '0', 10);
    if (wrong >= CLIENT_KEY_TRIES_)
      ApiError.fail(
        'key_locked',
        'Too many wrong keys. Wait ten minutes and try again.'
      );
    var key = String(accessKey || '').replace(/\D/g, '');
    if (!key) ApiError.fail('key_needed', 'This link needs its access key.');
    if (ClientsService.clientKeyHash(link, key) !== link.keyHash) {
      cache.put(tag, String(wrong + 1), KEY_WINDOW_S_);
      ApiError.fail('bad_access_key', 'That access key is not right.');
    }
  }

  /**
   * Resolves the token of a request to an active link.
   *
   * @param {?Object} req The request body, with `token` and `accessKey`.
   * @return {!Object} The link.
   * @throws {ApiError} When the link is unknown, off, ended or locked, or
   *     its key is wrong.
   */
  function requireClient_(req) {
    var cache = CacheService.getScriptCache();
    var hit = linkByToken_(cache, String(req?.token || ''));
    if (!hit.active) ApiError.fail('revoked', 'This link was turned off.');
    if (ClientsService.clientExpired(hit))
      ApiError.fail(
        'link_expired',
        'This link ended on ' +
          hit.expires.slice(0, ISO_DATE_LENGTH_) +
          '. Ask whoever sent it to extend it.'
      );
    if (hit.keyHash) checkAccessKey_(cache, hit, req?.accessKey);
    return hit;
  }

  /**
   * Says whether a link may see a form.
   *
   * @param {!Object} client The link.
   * @param {!Object} form The form.
   * @return {boolean} True when the link names the form or every form.
   */
  function clientAllows_(client, form) {
    return (
      client.forms.indexOf('*') !== -1 || client.forms.indexOf(form.id) !== -1
    );
  }

  return { requireClient: requireClient_, clientAllows: clientAllows_ };
})();
