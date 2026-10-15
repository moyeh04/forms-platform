/**
 * The registrations of a WhatsApp form on the instructor page: a table
 * with a row per registration and, when the link shows reviews, the review
 * of each step, which a link with review rights can change.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  /** The review states a step can take. */
  var REVIEWS = ['pending', 'approved', 'rejected'];

  /**
   * Saves the review of a step of a registration.
   *
   * @param {!Object} r The registration.
   * @param {!Object} st The step.
   * @param {string} v The review.
   */
  function saveReview(r, st, v) {
    V.call('viewer.review', {
      slug: S.slug,
      submissionId: r.id,
      stepId: st.id,
      status: v
    })
      .then(function () {
        r.review[st.id] = v;
        toast(st.label.en + ': ' + v, 'ok');
      })
      .catch(function (e) {
        toast(e.message, 'err');
      });
  }

  /**
   * Draws the review of a step: a badge, or a select when the link may
   * review.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} r The registration.
   * @param {!Object} st The step.
   * @return {!Element} The review.
   */
  function stepReview(d, r, st) {
    var cur = r.review?.[st.id] || 'pending';
    if (!d.canReview) {
      return h(
        'span',
        null,
        st.label.en + ': ',
        h('span', { class: 'badge ' + cur }, cur)
      );
    }
    var sel = V.select(
      cur,
      REVIEWS.map(function (x) {
        return [x, x[0].toUpperCase() + x.slice(1)];
      }),
      saveReview.bind(null, r, st)
    );
    sel.setAttribute('aria-label', st.label.en);
    return h(
      'label',
      null,
      h('span', { class: 'muted-note' }, st.label.en + ' '),
      sel
    );
  }

  /**
   * Draws the review cell of a registration: the review of each step.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} r The registration.
   * @return {!Element} The cell.
   */
  function reviewCell(d, r) {
    return h(
      'td',
      null,
      h(
        'div',
        { class: 'actions' },
        d.steps.map(function (st) {
          return stepReview(d, r, st);
        })
      )
    );
  }

  /**
   * Draws the registrations that hold the search.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The registrations.
   */
  V.registrations = function (d) {
    var rows = d.rows.filter(V.matches);
    if (!rows.length) {
      return h('div', { class: 'empty' }, 'No registrations to show.');
    }
    var cols = d.columns;
    return h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'data-table' },
        V.tableHead(cols),
        h(
          'tbody',
          null,
          rows.map(function (r) {
            return h(
              'tr',
              { dataset: { id: r.id } },
              cols.map(function (c) {
                return c.id === 'review' ? reviewCell(d, r) : V.cell(c.id, r);
              })
            );
          })
        )
      )
    );
  };
})(window.App);
