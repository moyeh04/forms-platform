/** The form actions: the public form definition and the admin form actions. */

var FormsController = (function () {
/**
 * Answers the `getForm` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function getForm(req) {
  var form = FormsRepository.requireForm(String(req.slug || ''));
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
  var out = { state: state, form: FormsPublic.publicForm(form), serverTime: Time.nowIso() };
  if (form.type === 'reservation') out.taken = slotAvailability_(form);
  return out;
}

/**
 * Answers the `admin.forms.list` action.
 *
 * @return {*} The answer, sent back as JSON.
 */
function list() {
  return { forms: FormsRepository.readForms() };
}

/**
 * Answers the `admin.forms.get` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function get(req) {
  var form = FormsRepository.requireForm(req.id);
  var out = { form: form, lists: ListsRepository.readLists(), listInfo: ListsRepository.readListInfo() };
  // The timetable editor marks slots that already have bookings.
  if (form.type === 'reservation') {
    out.taken = slotAvailability_(form);
    out.keySources = keyBookingSources_(form).map(function (s) {
      return { id: s.id, title: s.title, term: FormMetadata.slug(s) };
    });
  }
  // The team size and teammates panels count the saved answers that a new range would leave outside.
  if (Rules.fieldByRole(form, 'team_size')) out.teamSizes = ResponsesRules.teamSizes(form);
  if (form.type === 'reservation' && Rules.fieldByRole(form, 'members'))
    out.teammateCounts = ResponsesRules.teammateCounts(form);
  return out;
}

/**
 * Answers the `admin.forms.create` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function create(req) {
  return { form: FormsService.createForm(req) };
}

/**
 * req: id, patch, and base (the `updatedAt` of the copy the page showed, so a newer save is not overwritten).
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function update(req) {
  return { form: FormsService.updateForm(req.id, req.patch || {}, req.base) };
}

/**
 * Answers the `admin.forms.duplicate` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function duplicate(req) {
  return { form: FormsService.duplicateForm(req.id, req) };
}

/**
 * Answers the `admin.forms.delete` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function remove(req) {
  var form = FormsRepository.requireForm(req.id);
  // The page sends the link name back as a deliberate second key, so a stray call cannot delete a form.
  if (String(req.confirm || '') !== form.slug)
    ApiError.fail('confirm_required', 'Confirm by sending the form link name.');
  return FormsService.deleteForm(form.id);
}

return { getForm, list, get, create, update, duplicate, remove };
})();
