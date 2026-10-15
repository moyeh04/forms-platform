/**
 * The progress actions: a mark by the admin, a mark by an instructor link
 * that may mark, and a team reading its own progress with its key.
 */

var ProgressController = (function () {
  /**
   * Gives the marks of a team as the admin sees them: all of them.
   *
   * @param {!Object} progress The marks.
   * @return {!Object} The same marks.
   */
  function whole_(progress) {
    return progress;
  }

  /**
   * Answers the `admin.progress.mark` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function adminMark(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    return { progress: ProgressService.mark(form, req, 'a', whole_) };
  }

  /**
   * Answers the `viewer.progress.mark` action. Only a link that may mark
   * does; it gets the marks back as a link sees them.
   *
   * @param {!Object} req The request body.
   * @param {!Object} client The private link, checked by the router.
   * @return {*} The answer, sent back as JSON.
   */
  function viewerMark(req, client) {
    var form = ViewerService.requireClientForm(client, req.slug);
    if (client.progress !== ProgressAccess.MARK) {
      ApiError.fail('forbidden', 'This link cannot mark progress.');
    }
    return {
      progress: ProgressService.mark(
        form,
        req,
        'c:' + client.id,
        Rules.linkProgress.bind(null, form)
      )
    };
  }

  /**
   * Answers the `progress.mine` action.
   *
   * @param {!Object} req The request body: `slug` and `key`.
   * @return {*} The answer, sent back as JSON.
   */
  function mine(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    return { progress: ProgressService.mine(form, req.key) };
  }

  return { adminMark, viewerMark, mine };
})();
