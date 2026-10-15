/** The admin action that rebuilds the sheet views. */

var API = API || {};

API['admin.views.rebuild'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  rebuildViews(form);
  return { rebuilt: true, sheetUrl: form.sheetUrl };
});
