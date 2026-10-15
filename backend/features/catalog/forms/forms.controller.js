/** The form actions: the public form definition and the admin form actions. */

var API = API || {};

API.getForm = function (req) {
  var form = requireForm(String(req.slug || ''));
  var state = Rules.formState(form);
  if (state === 'draft' || state === 'archived') {
    var draft = {
      slug: form.slug,
      type: form.type,
      title: form.title,
      lang: form.lang,
      icon: form.icon,
      messages: form.messages
    };
    Object.assign(draft, FormMetadata.public(form));
    return { state: state, form: draft };
  }
  var out = { state: state, form: publicForm(form), serverTime: Time.nowIso() };
  if (form.type === 'reservation') out.taken = slotAvailability_(form);
  return out;
};

API['admin.forms.list'] = admin(function () {
  return { forms: readForms() };
});

API['admin.forms.get'] = admin(function (req) {
  var form = requireForm(req.id);
  var out = { form: form, lists: readLists(), listInfo: readListInfo() };
  // The timetable editor marks slots that already have bookings.
  if (form.type === 'reservation') {
    out.taken = slotAvailability_(form);
    out.keySources = keyBookingSources_(form).map(function (s) {
      return { id: s.id, title: s.title, term: FormMetadata.slug(s) };
    });
  }
  // The team size and teammates panels count the saved answers that a new range would leave outside.
  if (Rules.fieldByRole(form, 'team_size')) out.teamSizes = teamSizes_(form);
  if (form.type === 'reservation' && Rules.fieldByRole(form, 'members'))
    out.teammateCounts = teammateCounts_(form);
  return out;
});

API['admin.forms.create'] = admin(function (req) {
  return { form: createForm(req) };
});

/** req: id, patch, and base (the `updatedAt` of the copy the page showed, so a newer save is not overwritten). */
API['admin.forms.update'] = admin(function (req) {
  return { form: updateForm(req.id, req.patch || {}, req.base) };
});

API['admin.forms.duplicate'] = admin(function (req) {
  return { form: duplicateForm(req.id, req) };
});

API['admin.forms.delete'] = admin(function (req) {
  var form = requireForm(req.id);
  // The page sends the link name back as a deliberate second key, so a stray call cannot delete a form.
  if (String(req.confirm || '') !== form.slug)
    ApiError.fail('confirm_required', 'Confirm by sending the form link name.');
  return deleteForm(form.id);
});
