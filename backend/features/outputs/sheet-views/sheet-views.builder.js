/**
 * Styled views inside each form's own spreadsheet: the team list, the
 * bookings and the registrations. Every team (or day, or registration) is a
 * block with its own tint and a heavy border around it, so the eye can match
 * a name to its task, code or slot at a glance. `SheetViewsTeamList`,
 * `SheetViewsBookings` and `SheetViewsRegistrations` build them.
 */

var SheetViewsBuilder = (function () {
  /**
   * Sorts records by when they were created, oldest first.
   *
   * @param {{created: string}} a One record.
   * @param {{created: string}} b Another.
   * @return {number} -1, 0 or 1.
   */
  function byCreated_(a, b) {
    if (a.created < b.created) return -1;
    return a.created > b.created ? 1 : 0;
  }

  /**
   * Rebuilds the Team Members List view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function teamList_(form, ss) {
    SheetViewsTeamList.build(form, ss);
  }

  /**
   * Rebuilds the Bookings view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function bookings_(form, ss) {
    SheetViewsBookings.build(form, ss);
  }

  /**
   * Rebuilds the Registrations view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function registrations_(form, ss) {
    SheetViewsRegistrations.build(form, ss);
  }

  /** The view each type of form gets. */
  var VIEW_BUILDERS_ = {
    team_registration: teamList_,
    task_submission: teamList_,
    reservation: bookings_,
    whatsapp_registration: registrations_
  };

  return { byCreated: byCreated_, VIEW_BUILDERS: VIEW_BUILDERS_ };
})();
