/**
 * The controls every list of responses shares: an Arabic name, a cell
 * with its label for the narrow layout, the status and review selects and
 * the Details button.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  /**
   * Draws a name that may be Arabic, isolated from the text around it.
   *
   * @param {string} text The name.
   * @return {!Element} The name.
   */
  R.bdi = function (text) {
    return h('bdi', { lang: 'ar' }, text || '');
  };

  /**
   * Gives a cell the label the narrow layout shows beside it.
   *
   * @param {string} label The label.
   * @param {!Element} td The cell.
   * @return {!Element} The same cell.
   */
  R.labelled = function (label, td) {
    td.dataset.label = label;
    return td;
  };

  /**
   * Draws the select that sets the status of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {!Element} The select.
   */
  R.statusSelect = function (form, s) {
    var sel = A.select(
      s.status,
      A.SUB_STATUSES.map(function (x) {
        return [x, A.SUB_LABEL[x]];
      }),
      function (v) {
        A.call('admin.submission.update', {
          slug: form.slug,
          submissionId: s.id,
          patch: { status: v }
        })
          .then(function () {
            s.status = v;
            toast('Status updated', 'ok');
          })
          .catch(A.fail);
      }
    );
    sel.setAttribute('aria-label', 'Status of ' + s.ref);
    return sel;
  };

  /**
   * Draws the select that sets one review step of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {!Object} step The review step.
   * @return {!Element} The select.
   */
  R.reviewSelect = function (form, s, step) {
    var sel = A.select(
      s.review?.[step.id] || 'pending',
      A.REVIEW.map(function (x) {
        return [x, A.SUB_LABEL[x]];
      }),
      function (v) {
        var patch = { review: {} };
        patch.review[step.id] = v;
        A.call('admin.submission.update', {
          slug: form.slug,
          submissionId: s.id,
          patch: patch
        })
          .then(function () {
            s.review[step.id] = v;
            toast(step.label.en + ': ' + v, 'ok');
          })
          .catch(A.fail);
      }
    );
    sel.setAttribute('aria-label', step.label.en + ' for ' + s.ref);
    return sel;
  };

  /**
   * Draws the button that opens the details of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The button.
   */
  R.detailsButton = function (form, s, reload) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: 'details',
        onclick: function () {
          R.details(form, s, reload);
        }
      },
      'Details'
    );
  };
})(window.App);
