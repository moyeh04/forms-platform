/**
 * Printing and the CSV file: a print tab made in the Google Sheet, shown
 * in a dialog with its PDF, and the CSV file saved from the browser.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /** How long the address of the saved file is kept before it is freed. */
  var REVOKE_AFTER_MS = 2000;

  /**
   * Draws a link styled as a button that opens in a new tab.
   *
   * @param {string} cls The class of the button.
   * @param {string} href Where it goes.
   * @param {string} text What it says.
   * @return {!Element} The link.
   */
  function openLink(cls, href, text) {
    return h(
      'a',
      { class: 'btn ' + cls, href: href, target: '_blank', rel: 'noopener' },
      text
    );
  }

  /**
   * Has the server make a print tab, then shows where to open it.
   *
   * @param {!Element} btn The button, busy while it waits.
   * @param {string} action The server action.
   * @param {!Object} form The form to print; the server finds it by slug.
   * @param {!Object=} extra What else the action takes.
   */
  R.printOut = function (btn, action, form, extra) {
    A.busy(btn, async function () {
      var r = await A.call(action, Object.assign({ slug: form.slug }, extra));
      var body = h(
        'div',
        null,
        h(
          'p',
          null,
          r.count + ' row(s) are ready in a print tab of the Google Sheet.'
        ),
        h(
          'div',
          { class: 'actions' },
          openLink('btn-primary', r.sheetUrl, 'Open print tab'),
          r.pdfUrl ? openLink('btn-quiet', r.pdfUrl, 'Open PDF') : null
        ),
        r.pdfUrl
          ? null
          : h(
              'p',
              { class: 'help' },
              'The PDF could not be made automatically. Open the print tab' +
                ' and use File > Print.'
            )
      );
      A.modal('Ready to print', body);
    });
  };

  /**
   * Writes a value as a quoted CSV cell.
   *
   * @param {*} v The value.
   * @return {string} The cell.
   */
  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  /**
   * Saves the submissions shown as a CSV file named after the form.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The submissions.
   */
  R.downloadCsv = function (form, rows) {
    var csv =
      '\ufeff' +
      R.csvLines(form, rows)
        .map(function (r) {
          return r.map(csvCell).join(',');
        })
        .join('\r\n');
    var url;
    var a;
    try {
      url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' })
      );
      a = h('a', { href: url, download: form.slug + '.csv' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, REVOKE_AFTER_MS);
    } catch {
      ui.toast('Could not make the file here.', 'err');
    }
  };
})(window.App);
