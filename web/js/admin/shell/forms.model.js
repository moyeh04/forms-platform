/**
 * The rules of the forms list about bookings: which forms give keys, which
 * can start a series of bookings, and which form a booking belongs to.
 */
(function (App) {
  'use strict';

  var A = App.admin;

  /**
   * Says whether a form gives its students a key, so bookings can be
   * opened with it.
   *
   * @param {!Object} f The form.
   * @return {boolean} True when it does.
   */
  A.issuesKeys = function (f) {
    return f.type !== FormType.RESERVATION && !!f.editKey?.enabled;
  };

  /**
   * Says whether a form has teams: the first booking is offered on a team
   * or a task form.
   *
   * @param {!Object} f The form.
   * @return {boolean} True when it has.
   */
  A.hasTeams = function (f) {
    return (
      f.type === FormType.TEAM_REGISTRATION ||
      f.type === FormType.TASK_SUBMISSION
    );
  };

  /**
   * Gives the form whose keys open a booking.
   *
   * @param {!Object} f The form.
   * @return {string} The id of that form, or '' when it is not such a
   *     booking.
   */
  A.bookedBy = function (f) {
    return f.type === FormType.RESERVATION && f.keyBooking?.enabled
      ? f.keyBooking.source
      : '';
  };
})(window.App);
