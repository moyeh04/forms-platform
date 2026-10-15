/**
 * Print-ready tabs and their PDF export. The tabs are rebuilt on demand, so
 * they always show the latest data; `PrintReservations` and `PrintTeamList`
 * build them.
 */

var PrintService = (function () {
  /** The status of a PDF export that worked. */
  var HTTP_OK_ = 200;

  /** The Drive folder the PDFs go to. */
  var EXPORTS_FOLDER_ = 'Exports';

  /** The PDF layout of a print tab, as export URL parameters. */
  var PDF_OPTIONS_ = [
    'size=A4',
    'fitw=true',
    'gridlines=false',
    'printtitle=false',
    'sheetnames=false',
    'pagenumbers=true',
    'attachment=false'
  ];

  /**
   * Makes the link to the start of a spreadsheet's file.
   *
   * @param {!Object} form The form whose spreadsheet it is.
   * @return {string} The link, without a page.
   */
  function sheetBase_(form) {
    return 'https://docs.google.com/spreadsheets/d/' + form.sheetId;
  }

  /**
   * Finds the Drive folder of the PDFs, making it when it is missing.
   *
   * @return {!DriveApp.Folder} The folder.
   */
  function exportsFolder_() {
    var root = RegistryRepository.rootFolder();
    var it = root.getFoldersByName(EXPORTS_FOLDER_);
    return it.hasNext() ? it.next() : root.createFolder(EXPORTS_FOLDER_);
  }

  /**
   * Makes the PDF export link of a print tab.
   *
   * @param {!Object} form The form.
   * @param {{gid: number, landscape: boolean}} printed The tab.
   * @return {string} The link.
   */
  function pdfLink_(form, printed) {
    var params = [
      'format=pdf',
      'gid=' + printed.gid,
      PDF_OPTIONS_[0],
      'portrait=' + (printed.landscape ? 'false' : 'true')
    ].concat(PDF_OPTIONS_.slice(1));
    return sheetBase_(form) + '/export?' + params.join('&');
  }

  /**
   * Saves a print tab as a PDF in Drive.
   *
   * @param {!Object} form The form.
   * @param {{sheetName: string, gid: number, landscape: boolean}} printed
   *     The tab.
   * @return {?string} The link of the PDF, or null when Google refuses.
   */
  function exportPdf_(form, printed) {
    var resp;
    var name;
    try {
      resp = UrlFetchApp.fetch(pdfLink_(form, printed), {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() !== HTTP_OK_) return null;
      name = printed.sheetName.replace(/^Print - /, '') + '.pdf';
      return exportsFolder_().createFile(resp.getBlob().setName(name)).getUrl();
    } catch (e) {
      Logger.log('PDF export failed: ' + e.message);
      return null;
    }
  }

  /**
   * Describes a printed tab with its links, exporting it as a PDF.
   *
   * @param {!Object} form The form.
   * @param {{sheetName: string, gid: number, count: number,
   *     landscape: boolean}} printed The tab.
   * @return {{count: number, sheetName: string, sheetUrl: string,
   *     pdfUrl: ?string}} The result.
   */
  function printResult_(form, printed) {
    return {
      count: printed.count,
      sheetName: printed.sheetName,
      sheetUrl: sheetBase_(form) + '/edit#gid=' + printed.gid,
      pdfUrl: exportPdf_(form, printed)
    };
  }

  /**
   * Rebuilds the print tab of one day of reservations.
   *
   * @param {!Object} form The form.
   * @param {string} dayId The id of the day.
   * @param {boolean} includeEmpty Whether free times get an empty row.
   * @return {!Object} The tab, for `printResult`.
   */
  function printReservations_(form, dayId, includeEmpty) {
    return PrintReservations.printDay(form, dayId, includeEmpty);
  }

  /**
   * Rebuilds the print tab of the team list.
   *
   * @param {!Object} form The form.
   * @return {!Object} The tab, for `printResult`.
   */
  function printTeamList_(form) {
    return PrintTeamList.printList(form);
  }

  return {
    exportsFolder: exportsFolder_,
    printReservations: printReservations_,
    printTeamList: printTeamList_,
    printResult: printResult_
  };
})();
