/** Form management for the admin and the public form definition. */

var API = API || {};

API.getForm = function (req) {
  var form = requireForm(String(req.slug || ''));
  var state = Rules.formState(form);
  if (state === 'draft' || state === 'archived') {
    return { state: state, form: { slug: form.slug, title: form.title, term: form.term, lang: form.lang, icon: form.icon, messages: form.messages } };
  }
  return { state: state, form: publicForm(form), serverTime: nowIso() };
};

API['admin.forms.list'] = admin(function () {
  var forms = readForms().map(function (f) {
    var o = clone(f);
    delete o._row;
    return o;
  });
  return { forms: forms };
});

API['admin.forms.get'] = admin(function (req) {
  var f = clone(requireForm(req.id));
  delete f._row;
  return { form: f, lists: readLists() };
});

API['admin.forms.create'] = admin(function (req) {
  var f = clone(createForm(req));
  delete f._row;
  return { form: f };
});

API['admin.forms.update'] = admin(function (req) {
  var f = clone(updateForm(req.id, req.patch || {}));
  delete f._row;
  return { form: f };
});

API['admin.forms.duplicate'] = admin(function (req) {
  var f = clone(duplicateForm(req.id, req));
  delete f._row;
  return { form: f };
});

API['admin.lists.get'] = admin(function () {
  return { lists: readLists() };
});

API['admin.lists.set'] = admin(function (req) {
  if (!req.key) fail('key_required', 'A list needs a name.');
  saveList(String(req.key), req.values || []);
  return { lists: readLists() };
});
