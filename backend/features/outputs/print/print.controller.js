/** The print actions of the admin. */

var PrintController = (function () {
/**
 * Answers the `admin.print.reservations` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function reservations(req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  if (form.type !== 'reservation')
    ApiError.fail('wrong_type', 'Only reservation forms have days to print.');
  return PrintService.printResult(
    form,
    PrintService.printReservations(form, String(req.dayId || ''), !!req.includeEmpty)
  );
}

/**
 * Answers the `admin.print.teamList` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function teamList(req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  if (!TeamsService.isTeamForm(form))
    ApiError.fail('wrong_type', 'Only team and task forms have a team list.');
  return PrintService.printResult(form, PrintService.printTeamList(form));
}

return { reservations, teamList };
})();
