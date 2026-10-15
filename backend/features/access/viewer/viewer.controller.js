/**
 * The actions of the instructor page: who the link is, its data and its
 * reviews.
 */

var ViewerController = (function () {
  /**
   * Answers the `viewer.me` action.
   *
   * @param {!Object} _req The request body, which holds nothing else.
   * @param {!Object} client The private link, checked by the router.
   * @return {*} The answer, sent back as JSON.
   */
  function me(_req, client) {
    return {
      client: { name: client.name, canReview: client.canReview },
      forms: ViewerRules.viewerForms(client).map(function (f) {
        return Object.assign(ViewerRules.viewFormMetadata(f), { icon: f.icon });
      })
    };
  }

  /**
   * Answers the `viewer.data` action.
   *
   * @param {!Object} req The request body.
   * @param {!Object} client The private link, checked by the router.
   * @return {*} The answer, sent back as JSON.
   */
  function data(req, client) {
    var form = ViewerService.requireClientForm(client, req.slug);
    var vform = FormsPublic.validationForm(form);
    var kind = ViewerRules.viewKind(form);
    var mode = req.mode === 'today' || req.mode === 'day' ? req.mode : 'all';
    var out = {
      form: ViewerRules.viewFormMetadata(form),
      kind: kind,
      columns: ViewerRules.visibleColumns(client, form),
      canReview: client.canReview,
      steps: (form.review && form.review.steps) || [],
      generatedAt: Time.nowIso()
    };
    if (kind === 'reservation') {
      out.today = Time.todayIso();
      out.days = ((form.slots && form.slots.days) || []).map(function (d) {
        return { id: d.id, label: d.label, date: d.date };
      });
      out.rows = ViewerService.reservationRows(
        vform,
        client,
        mode,
        String(req.dayId || '')
      );
    } else if (kind === 'team') {
      out.groups = ViewerService.teamGroups(vform, client);
      out.sizeAlerts = ViewerService.viewerSizeAlerts(form, client);
    } else {
      out.rows = ViewerService.whatsappRows(vform, client);
    }
    return out;
  }

  /**
   * Answers the `viewer.review` action.
   *
   * @param {!Object} req The request body.
   * @param {!Object} client The private link, checked by the router.
   * @return {*} The answer, sent back as JSON.
   */
  function review(req, client) {
    var form = ViewerService.requireClientForm(client, req.slug);
    if (!client.canReview)
      ApiError.fail('forbidden', 'This link is read-only.');
    Lock.withLock(function () {
      var r = ResponsesRepository.readResponses(form).filter(function (x) {
        return x.id === req.submissionId;
      })[0];
      if (!r)
        ApiError.fail(
          'submission_not_found',
          'That submission does not exist.'
        );
      ResponsesReview.setReviewStep(
        form,
        r,
        String(req.stepId),
        String(req.status)
      );
      ResponsesRepository.saveResponse(form, r);
    });
    ResponsesNotify.afterChange(form);
    return { updated: true };
  }

  return { me, data, review };
})();
