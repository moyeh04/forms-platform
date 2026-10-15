/**
 * What follows a saved submission: the emails and the repaint of the sheet
 * views.
 */

var ResponsesNotify = (function () {
function siteLink_(form) {
  var base = Properties.getProp('SITE_URL');
  return base ? base.replace(/\/+$/, '') + '/?f=' + form.slug : '';
}

/** Sends the student's copy and the admin's alert. Returns true when the student's email went out. */
function sendConfirmation_(form, result, data) {
  var sent = false;
  try {
    var to = Rules.valueByRole(form, data, 'email');
    var n = form.notifications || {};
    if (n.confirmEmail !== false && to) {
      var lines = [
        'Your registration was received.',
        '',
        'Form: ' +
          form.title +
          (FormMetadata.caption(form)
            ? ' (' + FormMetadata.caption(form) + ')'
            : ''),
        'Reference: ' + result.ref
      ];
      var keyed = form.editKey && form.editKey.enabled;
      if (keyed) {
        lines.push(
          'Edit key: ' + result.key,
          'The key works until ' + result.keyExpires.slice(0, 10) + '.'
        );
        var link = siteLink_(form);
        if (link) lines.push('Edit or delete here: ' + link);
      }
      lines.push(
        '',
        'تم استلام تسجيلك. ' +
          (keyed ? 'احتفظ بالرقم المرجعي والمفتاح.' : 'احتفظ بالرقم المرجعي.')
      );
      MailApp.sendEmail({
        to: to,
        subject: '[' + form.title + '] Registration received - ' + result.ref,
        body: lines.join('\n')
      });
      sent = true;
    }
    if (n.alertEmail) {
      MailApp.sendEmail({
        to: n.alertEmail,
        subject: '[' + form.title + '] New submission ' + result.ref,
        body: 'A new submission arrived: ' + result.ref
      });
    }
  } catch (e) {
    Logger.log('Email not sent: ' + e.message);
  }
  return sent;
}

/** After a saved change: the form's sheet views are marked for a repaint. A failure here never fails the save. */
function afterChange_(form) {
  try {
    refreshViews(form);
  } catch (e) {
    Logger.log('Views not marked: ' + e.message);
  }
}

return { afterChange: afterChange_, sendConfirmation: sendConfirmation_, siteLink: siteLink_ };
})();
