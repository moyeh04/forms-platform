/**
 * When registration edit keys stop working, and moving that date for one, some or all of a
 * form's registrations. A key gets new time from today or from its end date, whichever is
 * later, so an expired key works again for the whole period.
 */

var API = API || {};

var KEY_EXTEND_MAX_DAYS_ = 365;

function keyRow_(r) {
  return {
    id: r.id,
    ref: r.ref,
    name: String(r.name || ''),
    title: String(r.title || ''),
    keyExpires: r.keyExpires,
    expired: !!(r.keyExpires && Date.parse(r.keyExpires) < Date.now())
  };
}

/** The live registrations of a form that hold a key. */
function keyedRows_(form) {
  return readResponses(form).filter(function (r) {
    return r.keyHash;
  });
}

/** The new end of one key: `until` as given, or `days` added to the later of now and its end. */
function extendedExpiry_(current, days, until) {
  if (until) return until;
  var from = Math.max(Date.now(), Date.parse(current) || 0);
  return new Date(from + days * 86400000).toISOString();
}

API['admin.keys.list'] = AuthService.admin(function (req) {
  var form = requireForm(req.slug || req.id);
  return { keys: keyedRows_(form).map(keyRow_) };
});

/**
 * req: slug, which ('all', 'expired' or 'chosen'), ids (for 'chosen'), and either days
 * (1 to 365) or until (an ISO time in the future).
 */
API['admin.keys.extend'] = AuthService.admin(function (req) {
  var form = requireForm(req.slug || req.id);
  requireKeyEnabled_(form);
  var days = 0,
    until = '';
  if (req.until) {
    var t = Date.parse(String(req.until));
    if (isNaN(t)) ApiError.fail('bad_date', 'That end date is not a date.');
    if (t <= Date.now()) ApiError.fail('bad_date', 'Pick an end date in the future.');
    until = new Date(t).toISOString();
  } else {
    days = parseInt(req.days, 10);
    if (!(days >= 1 && days <= KEY_EXTEND_MAX_DAYS_))
      ApiError.fail('bad_days', 'Extend by 1 to ' + KEY_EXTEND_MAX_DAYS_ + ' days.');
  }
  var which = String(req.which || 'chosen');
  var ids = Array.isArray(req.ids) ? req.ids.map(String) : [];
  if (which === 'chosen' && !ids.length)
    ApiError.fail('none_chosen', 'Choose at least one registration.');

  var changed = Lock.withLock(function () {
    var rows = keyedRows_(form);
    var picked = rows.filter(function (r) {
      if (which === 'all') return true;
      if (which === 'expired') return keyRow_(r).expired;
      return ids.indexOf(r.id) !== -1;
    });
    if (which === 'chosen' && picked.length !== ids.length)
      ApiError.fail(
        'submission_not_found',
        'A chosen registration no longer exists. Open the list again.'
      );
    picked.forEach(function (r) {
      r.keyExpires = extendedExpiry_(r.keyExpires, days, until);
      saveResponse_(form, r);
    });
    return picked.length;
  });
  return { changed: changed, keys: keyedRows_(form).map(keyRow_) };
});
