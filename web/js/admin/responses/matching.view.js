/**
 * WhatsApp matching: the pasted join requests on the left, and on the
 * right the registration that uses the same phone number, to approve or
 * reject. The state of the view is one object, `m`, that its parts share.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /** What each match status is called. */
  var STATUS_NAMES = {
    none: 'No match',
    matched: 'Matched',
    duplicate: 'Duplicate'
  };

  /** The toast after each decision. */
  var DECIDED = {
    approved: 'Approved',
    rejected: 'Rejected',
    pending: 'Back to pending'
  };

  /**
   * Draws the badges of a request: its match status and its decision.
   *
   * @param {!Object} r The request.
   * @return {!Array<!Element>} The two badges.
   */
  R.matchBadges = function (r) {
    return [
      A.badge(STATUS_NAMES[r.status] || STATUS_NAMES.duplicate, r.status),
      A.badge(A.SUB_LABEL[r.decision] || r.decision, r.decision)
    ];
  };

  /**
   * Keeps the requests the chosen filter shows.
   *
   * @param {!Object} m The matching state.
   * @return {!Array<!Object>} The requests.
   */
  R.visibleRequests = function (m) {
    var f = m.filter;
    return m.data.requests.filter(function (r) {
      if (f === 'all') return true;
      if (STATUS_NAMES[f]) return r.status === f;
      return r.decision === f;
    });
  };

  /**
   * Finds the registration with an id.
   *
   * @param {!Object} m The matching state.
   * @param {string} id The id.
   * @return {!Object|undefined} The registration.
   */
  R.matchedSub = function (m, id) {
    return m.data.submissions.filter(function (s) {
      return s.id === id;
    })[0];
  };

  /**
   * Draws both sides again.
   *
   * @param {!Object} m The matching state.
   */
  function paint(m) {
    R.paintMatchList(m);
    R.paintMatchDetail(m);
  }

  /**
   * Loads the requests and draws them. The selection stays only when it
   * is asked to and the request is still there.
   *
   * @param {!Object} m The matching state.
   * @param {boolean} keepSelection True to keep the chosen request.
   * @return {!Promise} Settles once it is drawn.
   */
  async function load(m, keepSelection) {
    m.data = await A.call('admin.matching.list', { slug: m.form.slug });
    if (
      !keepSelection ||
      !m.data.requests.some(function (r) {
        return r.id === m.sel;
      })
    ) {
      m.sel = null;
    }
    m.paint();
  }

  /**
   * Finds the next pending request after one, in the order shown.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} q The request.
   * @return {!Object|undefined} The next pending request.
   */
  function nextPending(m, q) {
    var order = R.visibleRequests(m).map(function (r) {
      return r.id;
    });
    var at = order.indexOf(q.id);
    return m.data.requests.filter(function (r) {
      return (
        order.indexOf(r.id) > at && r.decision === 'pending' && r.id !== q.id
      );
    })[0];
  }

  /**
   * Saves a decision with the note, then moves on to the next pending
   * request.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} q The request.
   * @param {string} decision approved, rejected or pending.
   * @return {!Promise} Settles once it is saved and drawn.
   */
  R.decideMatch = function (m, q, decision) {
    return A.call('admin.matching.decide', {
      slug: m.form.slug,
      requestId: q.id,
      decision: decision,
      note: m.note
    })
      .then(function () {
        ui.toast(DECIDED[decision] || DECIDED.pending, 'ok');
        var next = nextPending(m, q);
        m.note = '';
        return m.load(false).then(function () {
          if (decision !== 'pending' && next) {
            m.sel = next.id;
            m.paint();
          }
        });
      })
      .catch(A.fail);
  };

  /**
   * Draws the matching view into its host.
   *
   * @param {!Object} form The form.
   * @param {!Element} host Where it goes.
   * @return {!Promise} Settles once it is drawn.
   */
  R.matching = async function (form, host) {
    var m = {
      form: form,
      data: null,
      filter: 'all',
      sel: null,
      note: '',
      left: h('div', { class: 'panel' }),
      right: h('div', { class: 'panel detail' })
    };
    m.paint = paint.bind(null, m);
    m.load = load.bind(null, m);
    host.appendChild(h('div', { class: 'split' }, m.left, m.right));
    await m.load(false);
  };
})(window.App);
