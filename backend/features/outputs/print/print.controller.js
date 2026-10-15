/** The print actions of the admin. */

var API = API || {};

API['admin.print.reservations'] = AuthService.admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (form.type !== 'reservation')
    ApiError.fail('wrong_type', 'Only reservation forms have days to print.');
  return printResult_(
    form,
    printReservations_(form, String(req.dayId || ''), !!req.includeEmpty)
  );
});

API['admin.print.teamList'] = AuthService.admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (!isTeamForm_(form))
    ApiError.fail('wrong_type', 'Only team and task forms have a team list.');
  return printResult_(form, printTeamList_(form));
});
