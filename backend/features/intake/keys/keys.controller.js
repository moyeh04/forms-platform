/** The admin actions on edit keys: list them and move their end date. */

var KeysController = (function () {
  /** The most days one extension may add. */
  var KEY_EXTEND_MAX_DAYS_ = 365;

  /**
   * Reads the end date of an extension.
   *
   * @param {*} raw The date as sent.
   * @return {string} The date in ISO form.
   * @throws {ApiError} `bad_date` when it is not a date in the future.
   */
  function untilOf_(raw) {
    var t = Date.parse(String(raw));
    if (Number.isNaN(t))
      ApiError.fail('bad_date', 'That end date is not a date.');
    if (t <= Date.now())
      ApiError.fail('bad_date', 'Pick an end date in the future.');
    return new Date(t).toISOString();
  }

  /**
   * Reads the days of an extension.
   *
   * @param {*} raw The days as sent.
   * @return {number} The days.
   * @throws {ApiError} `bad_days` when they are not 1 to the most allowed.
   */
  function daysOf_(raw) {
    var days = parseInt(raw, 10);
    if (!(days >= 1 && days <= KEY_EXTEND_MAX_DAYS_))
      ApiError.fail(
        'bad_days',
        'Extend by 1 to ' + KEY_EXTEND_MAX_DAYS_ + ' days.'
      );
    return days;
  }

  /**
   * Answers the `admin.keys.list` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function list(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    return { keys: KeysService.listKeys(form) };
  }

  /**
   * Answers the `admin.keys.extend` action. The body holds the slug, which
   * keys (`all`, `expired` or `chosen`), the ids for `chosen`, and either
   * days (1 to 365) or until (an ISO time in the future).
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function extend(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    KeysService.requireKeyEnabled(form);
    var span = req.until
      ? { days: 0, until: untilOf_(req.until) }
      : { days: daysOf_(req.days), until: '' };
    var which = String(req.which || 'chosen');
    var ids = Array.isArray(req.ids) ? req.ids.map(String) : [];
    if (which === 'chosen' && !ids.length)
      ApiError.fail('none_chosen', 'Choose at least one registration.');
    var changed = KeysService.extendKeys(form, which, ids, span);
    return { changed: changed, keys: KeysService.listKeys(form) };
  }

  return { list, extend };
})();
