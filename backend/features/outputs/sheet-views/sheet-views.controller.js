/** The admin action that rebuilds the sheet views. */

var API = API || {};

API['admin.views.rebuild'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  rebuildViews(form);
  return { rebuilt: true, sheetUrl: form.sheetUrl };
});
