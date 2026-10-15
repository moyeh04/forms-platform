/**
 * The state of the instructor page and its calls, with no drawing: the
 * link and the form in the address, the access key kept for the tab, and
 * the data of the open form.
 */
(function (App) {
  'use strict';

  var V = {};
  App.viewer = V;

  /**
   * Everything the page knows: the link (`token`), the open form (`slug`),
   * who the link is (`me`), the data of the form, the view of a booking
   * form (`mode`, `dayId`), the search, a reason the link cannot open, and
   * the access key with whether to ask for it and why it was refused.
   */
  V.state = {
    token: '',
    slug: '',
    me: null,
    data: null,
    mode: 'auto',
    dayId: '',
    q: '',
    error: '',
    key: '',
    askKey: false,
    keyError: ''
  };
  var S = V.state;

  /** The access key is kept for this tab only, under the link it opens. */
  var KEY_STORE = 'fp_viewer_key_';

  /** The errors that mean the link needs its key, or a right one. */
  V.KEY_ERRORS = ['key_needed', 'bad_access_key', 'key_locked'];

  /**
   * Reads the key kept for this link in this tab.
   *
   * @return {string} The key, or '' when none is kept or storage is off.
   */
  V.storedKey = function () {
    try {
      return window.sessionStorage.getItem(KEY_STORE + S.token) || '';
    } catch {
      return '';
    }
  };

  /**
   * Keeps the key for this link in this tab, or forgets it.
   *
   * @param {string} k The key, or '' to forget it.
   */
  V.storeKey = function (k) {
    try {
      if (k) window.sessionStorage.setItem(KEY_STORE + S.token, k);
      else window.sessionStorage.removeItem(KEY_STORE + S.token);
    } catch {
      /* storage off */
    }
  };

  /**
   * Calls the server as the link. Every call carries the key; the server
   * asks for it only when the link has one.
   *
   * @param {string} action The action.
   * @param {!Object=} extra What the action needs.
   * @return {!Promise<!Object>} The answer.
   */
  V.call = function (action, extra) {
    return App.api.viewer(
      action,
      S.token,
      Object.assign({ accessKey: S.key || undefined }, extra || {})
    );
  };

  /**
   * Reads the link (`t`) and the form (`f`) from the address.
   *
   * @return {{t: string, f: string}} The link and the form.
   */
  V.params = function () {
    var u = new URLSearchParams(window.location.search);
    return { t: u.get('t') || '', f: u.get('f') || '' };
  };

  /**
   * Whether a booking form has a day dated today.
   *
   * @param {!Object} d The data of the form.
   * @return {boolean} True when today is one of its days.
   */
  function hasToday(d) {
    return (
      d.kind === 'reservation' &&
      (d.days || []).some(function (x) {
        return x.date && x.date === d.today;
      })
    );
  }

  /**
   * Loads the data of the open form. The first load of a form picks its
   * view: today when a booking form has a day dated today, else all.
   *
   * @return {!Promise} Settles once the data is in the state.
   */
  V.load = async function () {
    S.data = await V.call('viewer.data', {
      slug: S.slug,
      mode: S.mode === 'auto' ? 'all' : S.mode,
      dayId: S.dayId
    });
    if (S.mode !== 'auto') return;
    S.mode = hasToday(S.data) ? 'today' : 'all';
    if (S.mode === 'today') {
      S.data = await V.call('viewer.data', { slug: S.slug, mode: 'today' });
    }
  };

  /**
   * Whether a row holds the search, in any of its values.
   *
   * @param {!Object} obj The row.
   * @return {boolean} True when it matches, or nothing is searched.
   */
  V.matches = function (obj) {
    var q = S.q.trim().toLowerCase();
    return !q || JSON.stringify(obj).toLowerCase().indexOf(q) !== -1;
  };
})(window.App);
