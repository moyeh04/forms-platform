/**
 * The steps of Download all that draw nothing. The backend
 * (features/outputs/downloads) does the work one team at a time; these
 * drive it, report how far it is, and save each zip part from the pieces
 * read through the API.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;

  /** Bytes in a kilobyte, and in a megabyte. */
  var KB = 1024;
  var MB = KB * KB;
  /** How long the address of a saved part is kept before it is freed. */
  var KEEP_URL_MS = 60000;

  /**
   * Writes a size in KB, or in MB from one megabyte up.
   *
   * @param {number} bytes The size.
   * @return {string} The size as shown.
   */
  R.sizeText = function (bytes) {
    return bytes < MB
      ? Math.max(1, Math.round(bytes / KB)) + ' KB'
      : (bytes / MB).toFixed(1) + ' MB';
  };

  /**
   * Turns a base64 piece into bytes.
   *
   * @param {string} data The piece, in base64.
   * @return {!Uint8Array} The bytes.
   */
  function bytesOf(data) {
    var bin = atob(data);
    var bytes = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /**
   * Hands bytes to the browser as a file.
   *
   * @param {!Array<!Uint8Array>} pieces The bytes.
   * @param {string} name The name of the file.
   */
  function saveFile(pieces, name) {
    var url = URL.createObjectURL(
      new Blob(pieces, { type: 'application/zip' })
    );
    var a = App.ui.h('a', { href: url, download: name, hidden: true });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, KEEP_URL_MS);
  }

  /**
   * Reads a packed part piece by piece and hands it to the browser as a
   * file.
   *
   * @param {!Object} form The form.
   * @param {string} job The download job.
   * @param {!Object} part The part: file, name and size.
   * @param {function(number, number)} onProgress Called with the bytes
   *     read and the size.
   * @return {!Promise} Settles once the file is handed over.
   */
  R.savePart = async function (form, job, part, onProgress) {
    var pieces = [];
    var offset = 0;
    var size = part.size;
    var c;
    while (offset !== null) {
      c = await A.call('admin.download.chunk', {
        slug: form.slug,
        job: job,
        file: part.file,
        offset: offset
      });
      pieces.push(bytesOf(c.data));
      size = c.size;
      offset = c.next;
      onProgress(offset === null ? size : offset, size);
    }
    saveFile(pieces, part.name);
  };

  /**
   * Has the backend save every file of the teams, one team at a time and
   * as many calls as each team needs.
   *
   * @param {!Object} d The download: form, open and progress.
   * @param {!Object} start What the job started with: job and teams.
   * @return {!Promise<boolean>} False when the window was closed.
   */
  async function saveTeams(d, start) {
    var files = 0;
    var n = start.teams.length;
    var t;
    var r;
    var done;
    var i;
    for (i = 0; i < n; i++) {
      t = start.teams[i];
      d.progress.team(t, n, files);
      for (done = false; !done; ) {
        if (!d.open()) return false;
        r = await A.call('admin.download.team', {
          slug: d.form.slug,
          job: start.job,
          ref: t.ref
        });
        files += r.saved;
        done = r.done;
      }
      d.progress.step(i + 1);
    }
    return true;
  }

  /**
   * Has the backend pack the saved files into zip parts.
   *
   * @param {!Object} d The download: form, open and progress.
   * @param {string} job The download job.
   * @param {number} count How many parts.
   * @return {!Promise<?Array<!Object>>} The parts, or null when the window
   *     was closed.
   */
  async function packParts(d, job, count) {
    var parts = [];
    var p;
    for (p = 0; p < count; p++) {
      if (!d.open()) return null;
      d.progress.pack(p, count);
      parts.push(
        await A.call('admin.download.pack', {
          slug: d.form.slug,
          job: job,
          part: p
        })
      );
    }
    return parts;
  }

  /**
   * Runs a whole download: start the job, save the teams, write
   * Teams.xlsx and pack the parts.
   *
   * @param {!Object} d The download: form, open and progress.
   * @return {!Promise<?Object>} The start, the finish and the parts, or
   *     null when the window was closed.
   */
  R.runDownload = async function (d) {
    var start = await A.call('admin.download.start', { slug: d.form.slug });
    d.progress.begin(start.teams.length);
    if (!(await saveTeams(d, start))) return null;
    d.progress.writing();
    var fin = await A.call('admin.download.finish', {
      slug: d.form.slug,
      job: start.job
    });
    var parts = await packParts(d, start.job, fin.parts);
    return parts && { start: start, fin: fin, parts: parts };
  };
})(window.App);
