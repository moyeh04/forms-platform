/** The admin action that rebuilds the sheet views. */

var SheetViewsController = (function () {
  /**
   * Answers the `admin.views.rebuild` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function rebuild(req) {
    var form = FormsRepository.requireForm(req.slug || req.id);
    SheetViewsScheduler.rebuildViews(form);
    return { rebuilt: true, sheetUrl: form.sheetUrl };
  }

  return { rebuild };
})();
