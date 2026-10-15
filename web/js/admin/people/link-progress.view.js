/**
 * What a private link may do with the progress of teams: hidden, see the
 * board, or mark it. The dialog of a link picks it and the table names it.
 */
(function (App) {
  'use strict';

  var A = App.admin;

  /** Each choice, with the word the dialog and the table show. */
  var PROGRESS = [
    [ProgressAccess.HIDDEN, 'Hidden'],
    [ProgressAccess.SEE, 'Can see'],
    [ProgressAccess.MARK, 'Can mark']
  ];

  /**
   * Says what a link may do with the progress of teams.
   *
   * @param {string} access The link's progress access.
   * @return {string} Hidden, Can see or Can mark.
   */
  A.progressWord = function (access) {
    var known = PROGRESS.filter(function (x) {
      return x[0] === access;
    })[0];
    return (known || PROGRESS[1])[1];
  };

  /**
   * Draws the select of what a link may do with the progress of teams.
   *
   * @param {!Object} st The state of the dialog; `progress` changes.
   * @return {!Element} The field.
   */
  A.progressField = function (st) {
    var sel = A.select(st.progress, PROGRESS, function (v) {
      st.progress = v;
    });
    sel.name = 'progress';
    return A.field(
      'Team progress',
      sel,
      'Only on team registrations that follow milestones. Can mark lets them' +
        ' set states and write notes.'
    );
  };
})(window.App);
