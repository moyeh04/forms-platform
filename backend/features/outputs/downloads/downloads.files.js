/**
 * The files of a Download all job: their bytes, read from Drive or exported
 * to the matching Office format, the names they get in the zip, and the
 * retries when Google is busy.
 */

var DownloadsFiles = (function () {
  /** The biggest file the job packs: about Apps Script's limit, 45 MB. */
  var FILE_MAX_BYTES_ = 47185920;

  /** The bytes in a megabyte, to say how big a file is. */
  var MB_ = 1048576;

  /** The longest name a file or folder gets in the zip. */
  var MAX_NAME_LENGTH_ = 80;

  /** How many times a busy call is tried again. */
  var RETRIES_ = 3;

  /** The wait before the first retry, doubled for each next one. */
  var FIRST_WAIT_MS_ = 1000;

  /** The status of a request that worked. */
  var HTTP_OK = 200;

  /** The status Google gives when it is asked too often. */
  var HTTP_TOO_MANY = 429;

  /** The first status of a server error, which may pass. */
  var HTTP_SERVER_ERROR = 500;

  /** The error a busy answer throws, so `retry` tries it again. */
  var BUSY_MESSAGE = '429 try again';

  /** The errors that mean Google is busy, not that the call is wrong. */
  var BUSY_ = /rate|too many|quota|429|503|try again|backend error/i;

  /** The characters a name in a zip may not hold, control ones too. */
  // biome-ignore lint/suspicious/noControlCharactersInRegex: it removes them
  var BAD_NAME_CHARS_ = /[\\/:*?"<>|\u0000-\u001F]+/g;

  /** What a Google file is saved as: its extension and export address. */
  var EXPORTS = {
    'application/vnd.google-apps.presentation': [
      'pptx',
      'https://docs.google.com/presentation/d/{id}/export/pptx'
    ],
    'application/vnd.google-apps.document': [
      'docx',
      'https://docs.google.com/document/d/{id}/export?format=docx'
    ],
    'application/vnd.google-apps.spreadsheet': [
      'xlsx',
      'https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx'
    ],
    'application/vnd.google-apps.drawing': [
      'png',
      'https://docs.google.com/drawings/d/{id}/export/png'
    ]
  };

  /**
   * Makes a name that is safe in a zip on any computer.
   *
   * @param {*} text The name.
   * @param {string=} fallback What an empty name becomes.
   * @return {string} The name.
   */
  function safeName(text, fallback) {
    var s = String(text || '')
      .replace(BAD_NAME_CHARS_, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '');
    return (s || fallback || 'file').slice(0, MAX_NAME_LENGTH_).trim();
  }

  /**
   * Calls a function again, waiting longer each time, while Google says it
   * is busy.
   *
   * @param {function(): T} fn The call.
   * @return {T} What it returns.
   * @throws {Error} Its error, when not busy or out of tries.
   * @template T
   */
  function retry(fn) {
    var wait = FIRST_WAIT_MS_;
    var i;
    var busy;
    for (i = 0; ; i++) {
      try {
        return fn();
      } catch (e) {
        busy = BUSY_.test(String(e.message));
        if (!busy || i >= RETRIES_) throw e;
        Utilities.sleep(wait);
        wait *= 2;
      }
    }
  }

  /**
   * Says whether a status means Google is busy and the call may work later.
   *
   * @param {number} code The status.
   * @return {boolean} True when it may.
   */
  function busyStatus(code) {
    return code === HTTP_TOO_MANY || code >= HTTP_SERVER_ERROR;
  }

  /**
   * Exports a Google file to its Office format.
   *
   * @param {!DriveApp.File} file The file.
   * @param {!Array<string>} ex Its extension and export address.
   * @return {{blob: !Blob, ext: string}|{reason: string}} The bytes, or why
   *     Google would not give them.
   */
  function exportBlob_(file, ex) {
    var resp = retry(function () {
      var r = UrlFetchApp.fetch(ex[1].replace('{id}', file.getId()), {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (busyStatus(r.getResponseCode())) throw new Error(BUSY_MESSAGE);
      return r;
    });
    var code = resp.getResponseCode();
    if (code !== HTTP_OK) {
      return { reason: 'Google would not export it (' + code + ')' };
    }
    return { blob: resp.getBlob(), ext: ex[0] };
  }

  /**
   * Reads a file's bytes and the extension to save it with.
   *
   * @param {!DriveApp.File} file The file.
   * @return {{blob: !Blob, ext: string}|{reason: string}} The bytes, or why
   *     the file cannot be saved.
   */
  function blobOf(file) {
    var mime = String(file.getMimeType());
    var ex = EXPORTS[mime];
    if (ex) return exportBlob_(file, ex);
    if (mime.indexOf('application/vnd.google-apps.') === 0) {
      return { reason: 'This kind of Google file cannot be downloaded' };
    }
    var size = file.getSize();
    if (size > FILE_MAX_BYTES_) {
      return {
        reason:
          'Too big to pack (' +
          Math.round(size / MB_) +
          ' MB): open it in Drive'
      };
    }
    return {
      blob: retry(function () {
        return file.getBlob();
      }),
      ext: ''
    };
  }

  /**
   * Names a saved file: "Slides.pptx" stays, and "Slides" exported as pptx
   * becomes "Slides.pptx".
   *
   * @param {*} name The name in Drive.
   * @param {string} ext The extension it is saved with, or empty.
   * @return {string} The name in the zip.
   */
  function fileName(name, ext) {
    var n = safeName(name);
    var hasExt = new RegExp('\\.' + ext + '$', 'i').test(n);
    return ext && !hasExt ? n + '.' + ext : n;
  }

  return {
    EXPORTS,
    HTTP_OK,
    BUSY_MESSAGE,
    safeName,
    retry,
    busyStatus,
    blobOf,
    fileName
  };
})();
