/**
 * The Emails panel of a form: the confirmation each student gets, and the
 * note the admin gets for every new submission.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} n The notifications of the form.
   * @return {string} Which emails go out.
   */
  function summary(n) {
    return (
      (n.confirmEmail !== false
        ? 'Confirmation to students'
        : 'No confirmation') +
      (n.alertEmail ? ' · note to ' + n.alertEmail : '')
    );
  }

  /**
   * Draws the Emails panel. f.notifications is filled in.
   *
   * @param {!Object} s The settings page: `f`.
   * @return {!Element} The panel.
   */
  A.emailsPanel = function (s) {
    var n = s.f.notifications || {};
    s.f.notifications = n;
    var panel = A.panel(
      'Emails',
      'Emails go out from your Google account. Students always see their key' +
        ' on the success page, and you can look any key up under Responses,' +
        ' Details.',
      A.check(
        'Send each student a confirmation email with their reference and key',
        n.confirmEmail !== false,
        function (v) {
          n.confirmEmail = v;
        },
        { name: 'confirmEmail' }
      ),
      h(
        'p',
        { class: 'muted-note' },
        'Turned off, nothing is emailed to students. If you do not need their' +
          ' email address at all, also untick Show for the Email question' +
          ' above.'
      ),
      A.field(
        'Email me a note for every new submission',
        A.text(
          n.alertEmail || '',
          function (v) {
            n.alertEmail = v.trim();
          },
          { name: 'alertEmail', type: 'email', placeholder: 'you@example.com' }
        ),
        'Optional. Leave empty for no alerts.'
      )
    );
    panel.summary = summary.bind(null, n);
    return panel;
  };
})(window.App);
