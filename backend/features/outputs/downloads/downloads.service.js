/**
 * The steps of a Download all job beside saving the teams: starting it,
 * splitting the saved files into zip parts, packing a part, and reading a
 * packed zip in pieces.
 */

var DownloadsService = (function () {
  /** The length of an ISO time up to its minutes. */
  var TO_MINUTES_ = 16;

  /** The status of a ranged read that worked. */
  var HTTP_PARTIAL_ = 206;

  /** The base of the numbers a request sends. */
  var DECIMAL_ = 10;

  /** The name of the workbook in the zip. */
  var WORKBOOK_ = 'Teams.xlsx';

  /**
   * Moves the form's older work folders to the trash and makes a new one.
   *
   * @param {!Object} form The form.
   * @return {!DriveApp.Folder} The new folder.
   */
  function freshFolder_(form) {
    var downloads = DownloadsJobs.downloadsFolder();
    var old = downloads.getFolders();
    var f;
    while (old.hasNext()) {
      f = old.next();
      if (String(f.getName()).indexOf(form.slug + ' ') === 0) {
        f.setTrashed(true);
      }
    }
    var when = Time.nowIso().slice(0, TO_MINUTES_).replace('T', ' ');
    return downloads.createFolder(form.slug + ' ' + when);
  }

  /**
   * Starts a download: a fresh work folder (the form's older ones go to the
   * trash) and the list of teams.
   *
   * @param {!Object} form The form.
   * @return {{job: string, folderUrl: string, teams: !Array<!Object>}} The
   *     job and the teams to save one by one.
   * @throws {ApiError} `wrong_type` or `nothing_to_download`.
   */
  function start(form) {
    if (!TeamsService.isTeamForm(form)) {
      ApiError.fail(
        'wrong_type',
        'Only team and task forms can be downloaded.'
      );
    }
    var teams = TeamsService.teamBlocks(form);
    if (!teams.length) {
      ApiError.fail('nothing_to_download', 'Nobody has registered yet.');
    }
    var folder = freshFolder_(form);
    var job = {
      id: folder.getId(),
      form: form.id,
      folderId: folder.getId(),
      failed: []
    };
    DownloadsJobs.save(job);
    return {
      job: job.id,
      folderUrl: folder.getUrl(),
      teams: teams.map(function (t) {
        var p = t.link ? Rules.parseDriveLink(t.link) : { ok: false };
        return {
          ref: t.ref,
          number: t.number,
          title: t.title,
          kind: p.ok ? p.kind : ''
        };
      })
    };
  }

  /**
   * Splits files into zip parts that stay under the part size, the
   * workbook first.
   *
   * @param {!DriveApp.File} book The workbook.
   * @param {!Object<string, !DriveApp.File>} saved The files by path.
   * @return {!Array<!Array<string>>} The ids of each part.
   */
  function splitParts_(book, saved) {
    var parts = [[book.getId()]];
    var size = book.getSize();
    Object.keys(saved)
      .sort()
      .forEach(function (name) {
        var f = saved[name];
        var s = f.getSize();
        var last = parts[parts.length - 1];
        if (size + s > DownloadsJobs.PART_BYTES && last.length) {
          parts.push([]);
          size = 0;
        }
        parts[parts.length - 1].push(f.getId());
        size += s;
      });
    return parts;
  }

  /**
   * Writes the workbook and splits the saved files into zip parts.
   *
   * @param {!Object} form The form.
   * @param {!Object} job The job.
   * @return {{parts: number, files: number, failed: !Array<!Object>}} How
   *     many parts and files there are, and the files that failed.
   */
  function finish(form, job) {
    var saved = DownloadsJobs.savedFiles(job.folder);
    Object.keys(saved).forEach(function (n) {
      if (/\.zip$/.test(n) && !/\//.test(n)) delete saved[n];
    });
    delete saved[WORKBOOK_];
    var book = job.folder.createFile(
      DownloadsWorkbook.build(form, job, saved).setName(WORKBOOK_)
    );
    job.parts = splitParts_(book, saved);
    job.zips = [];
    DownloadsJobs.save(job);
    return {
      parts: job.parts.length,
      files: Object.keys(saved).length,
      failed: job.failed
    };
  }

  /**
   * Reads the number of a part and checks the job has it.
   *
   * @param {!Object} job The job.
   * @param {*} part The number the request sent.
   * @return {number} The part's index.
   * @throws {ApiError} `bad_part` when there is no such part.
   */
  function partIndex_(job, part) {
    var i = parseInt(part, DECIMAL_);
    if (!(i >= 0 && i < job.parts.length)) {
      ApiError.fail('bad_part', 'That part does not exist.');
    }
    return i;
  }

  /**
   * Packs one zip part, keeps it in the work folder, and moves its loose
   * files to the trash.
   *
   * @param {!Object} form The form.
   * @param {!Object} job The job.
   * @param {*} part The number of the part.
   * @return {{file: string, name: string, size: number}} The zip.
   * @throws {ApiError} `bad_part` when there is no such part.
   */
  function pack(form, job, part) {
    var i = partIndex_(job, part);
    var root = DownloadsFiles.safeName(form.title, form.slug);
    var files = job.parts[i].map(function (id) {
      return DriveApp.getFileById(id);
    });
    var blobs = files.map(function (f) {
      return f.getBlob().setName(root + '/' + f.getName());
    });
    var count = job.parts.length;
    var suffix = count > 1 ? ' - part ' + (i + 1) + ' of ' + count : '';
    var name = root + suffix + '.zip';
    var zip = job.folder.createFile(Utilities.zip(blobs, name));
    files.forEach(function (f) {
      f.setTrashed(true);
    });
    job.zips[i] = zip.getId();
    DownloadsJobs.save(job);
    return { file: zip.getId(), name: name, size: zip.getSize() };
  }

  /**
   * Reads a range of a Drive file, trying again while Google is busy.
   *
   * @param {string} fileId The file.
   * @param {number} from The first byte.
   * @param {number} to The byte after the last.
   * @return {!HTTPResponse} The answer.
   * @throws {ApiError} `download_failed` when Drive refuses.
   */
  function readRange_(fileId, from, to) {
    return DownloadsFiles.retry(function () {
      var r = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
        {
          headers: {
            Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
            Range: 'bytes=' + from + '-' + (to - 1)
          },
          muteHttpExceptions: true
        }
      );
      var code = r.getResponseCode();
      if (DownloadsFiles.busyStatus(code)) {
        throw new Error(DownloadsFiles.BUSY_MESSAGE);
      }
      if (code !== HTTP_PARTIAL_ && code !== DownloadsFiles.HTTP_OK) {
        ApiError.fail(
          'download_failed',
          'Drive would not give the file (' + code + '). Try again.'
        );
      }
      return r;
    });
  }

  /**
   * Reads a piece of a packed zip as base64, so the page can save it
   * without sharing anything. Only the piece is read from Drive, not the
   * whole zip each time.
   *
   * @param {!Object} job The job.
   * @param {string} fileId The zip.
   * @param {*} offset The first byte the page wants.
   * @return {{data: string, size: number, next: ?number}} The piece, the
   *     size of the zip, and where the next piece starts.
   * @throws {ApiError} `bad_part` when the zip is not of this job.
   */
  function chunk(job, fileId, offset) {
    if (job.zips.indexOf(fileId) === -1) {
      ApiError.fail('bad_part', 'That part does not exist.');
    }
    var size = DriveApp.getFileById(fileId).getSize();
    var from = Math.max(0, parseInt(offset, DECIMAL_) || 0);
    var to = Math.min(size, from + DownloadsJobs.CHUNK_BYTES);
    var resp = readRange_(fileId, from, to);
    return {
      data: Utilities.base64Encode(resp.getContent()),
      size: size,
      next: to < size ? to : null
    };
  }

  return { start, finish, pack, chunk };
})();
