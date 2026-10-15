/**
 * What follows a saved submission: the emails and the repaint of the sheet
 * views.
 */

var ResponsesNotify = (function () {
  /** The length of a date at the start of an ISO instant: `yyyy-MM-dd`. */
  var ISO_DATE_LENGTH_ = 10;

  /**
   * Gives the address of a form on the website.
   *
   * @param {!Object} form The form.
   * @return {string} The address, or an empty string when the website
   *     address is not set.
   */
  function siteLink_(form) {
    var base = Properties.getProp(Constants.PROPS.SITE_URL);
    return base ? base.replace(/\/+$/, '') + '/?f=' + form.slug : '';
  }

  /**
   * Writes the student's copy of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} result The saved submission: ref, key and key end.
   * @return {string} The body of the email.
   */
  function confirmationBody_(form, result) {
    var caption = FormMetadata.caption(form);
    var lines = [
      'Your registration was received.',
      '',
      'Form: ' + form.title + (caption ? ' (' + caption + ')' : ''),
      'Reference: ' + result.ref
    ];
    var keyed = form.editKey?.enabled;
    var link = keyed ? siteLink_(form) : '';
    if (keyed)
      lines.push(
        'Edit key: ' + result.key,
        'The key works until ' +
          result.keyExpires.slice(0, ISO_DATE_LENGTH_) +
          '.'
      );
    if (link) lines.push('Edit or delete here: ' + link);
    lines.push(
      '',
      'تم استلام تسجيلك. ' +
        (keyed ? 'احتفظ بالرقم المرجعي والمفتاح.' : 'احتفظ بالرقم المرجعي.')
    );
    return lines.join('\n');
  }

  /**
   * Sends the student's copy and the admin's alert. A failed email never
   * fails the save.
   *
   * @param {!Object} form The form.
   * @param {!Object} result The saved submission: ref, key and key end.
   * @param {!Object} data The answers.
   * @return {boolean} True when the student's email went out.
   */
  function sendConfirmation_(form, result, data) {
    var n = form.notifications || {};
    var sent = false;
    var to;
    try {
      to = Rules.valueByRole(form, data, 'email');
      if (n.confirmEmail !== false && to) {
        MailApp.sendEmail({
          to: to,
          subject: '[' + form.title + '] Registration received - ' + result.ref,
          body: confirmationBody_(form, result)
        });
        sent = true;
      }
      if (n.alertEmail)
        MailApp.sendEmail({
          to: n.alertEmail,
          subject: '[' + form.title + '] New submission ' + result.ref,
          body: 'A new submission arrived: ' + result.ref
        });
    } catch (e) {
      Logger.log('Email not sent: ' + e.message);
    }
    return sent;
  }

  /**
   * Marks the sheet views of a form for a repaint after a saved change. A
   * failure here never fails the save.
   *
   * @param {!Object} form The form.
   */
  function afterChange_(form) {
    try {
      SheetViewsScheduler.refreshViews(form);
    } catch (e) {
      Logger.log('Views not marked: ' + e.message);
    }
  }

  return {
    afterChange: afterChange_,
    sendConfirmation: sendConfirmation_,
    siteLink: siteLink_
  };
})();
