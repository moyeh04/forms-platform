/** The form actions: the public form definition and the admin form actions. */

var FormsController = (function () {
  /**
   * Answers the `getForm` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function getForm(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    return FormsPublic.publicState(form);
  }

  /**
   * Answers the `admin.forms.list` action.
   *
   * @return {*} The answer, sent back as JSON.
   */
  function list() {
    return { forms: FormsService.listForms() };
  }

  /**
   * Answers the `admin.forms.get` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function get(req) {
    return FormsService.adminForm(req.id);
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
   * Answers the `admin.forms.update` action: `id`, `patch`, and `base`,
   * the `updatedAt` of the copy the page showed, so a newer save is not
   * overwritten.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function update(req) {
    return { form: FormsPatch.updateForm(req.id, req.patch || {}, req.base) };
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
   * Answers the `admin.forms.delete` action. The page sends the link name
   * back as a deliberate second key.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function remove(req) {
    return FormsService.deleteConfirmed(req.id, req.confirm);
  }

  return { getForm, list, get, create, update, duplicate, remove };
})();
