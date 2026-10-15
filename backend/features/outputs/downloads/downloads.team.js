/**
 * Saving one team's things into the work folder of a Download all job: its
 * file, or its folder with every subfolder. A big folder is saved over
 * several requests, and a repeated request skips what is saved.
 */

var DownloadsTeam = (function () {
  /** A file's own extension, of one to five letters or digits. */
  var OWN_EXT_ = /\.([A-Za-z0-9]{1,5})$/;

  /**
   * Makes the saver of one request, with no saved files until they are
   * read.
   *
   * @param {!Object} job The job.
   * @param {!Object} team The team.
   * @return {!Object} The saver: the job and team, the `saved` and
   *     `failed` paths, and what this request did.
   */
  function saver_(job, team) {
    var s = {
      job: job,
      team: team,
      saved: {},
      failed: {},
      started: Date.now(),
      count: 0,
      savedNow: 0
    };
    job.failed.forEach(function (f) {
      s.failed[f.path] = true;
    });
    return s;
  }

  /**
   * Notes a file that cannot be saved, with why and where to open it.
   *
   * @param {!Object} s The saver.
   * @param {string} path The path it would have in the zip.
   * @param {string} reason Why it cannot be saved.
   * @param {string=} url Where to open it; the team's link when empty.
   */
  function miss_(s, path, reason, url) {
    s.job.failed.push({
      number: s.team.number,
      title: s.team.title,
      path: path,
      reason: reason,
      url: url || s.team.link
    });
  }

  /**
   * Saves one file under a path.
   *
   * @param {!Object} s The saver.
   * @param {!DriveApp.File} file The file.
   * @param {string} path Its path in the zip.
   * @return {boolean} False when the budget is spent and nothing was done.
   */
  function put_(s, file, path) {
    return putFile_(s, s.job, { file: file, path: path, team: s.team });
  }

  /**
   * Says whether the request has spent its budget of files or time.
   *
   * @param {!Object} s The saver.
   * @return {boolean} True when it must stop.
   */
  function spent_(s) {
    return (
      s.count >= DownloadsJobs.FILES_PER_CALL ||
      Date.now() - s.started > DownloadsJobs.BUDGET_MS
    );
  }

  /**
   * Gives the link of a file that failed, or the team's link.
   *
   * @param {{file: !DriveApp.File, team: !Object}} item The file and team.
   * @return {string} The link.
   */
  function urlOf_(item) {
    return item.file.getUrl ? item.file.getUrl() : item.team.link;
  }

  /**
   * Saves one file under a path, unless it is saved or failed already.
   *
   * @param {!Object} s The saver.
   * @param {!Object} job The job.
   * @param {{file: !DriveApp.File, path: string, team: !Object}} item The
   *     file, its path in the zip and its team.
   * @return {boolean} False when the budget is spent and nothing was done.
   */
  function putFile_(s, job, item) {
    var path = item.path;
    if (s.saved[path] || s.failed[path]) return true;
    if (spent_(s)) return false;
    s.count++;
    var got;
    try {
      got = DownloadsFiles.blobOf(item.file);
    } catch (e) {
      got = { reason: 'Could not be read: ' + e.message };
    }
    if (got.reason) {
      miss_(s, path, got.reason, urlOf_(item));
      s.failed[path] = true;
      return true;
    }
    job.folder.createFile(got.blob.setName(path));
    s.saved[path] = true;
    s.savedNow++;
    return true;
  }

  /**
   * Saves a team's single file, named after the team.
   *
   * @param {!Object} s The saver.
   * @param {string} id The id of the file.
   * @param {string} base Where the team's things go.
   * @return {boolean} False when the budget is spent.
   */
  function saveFile_(s, id, base) {
    var file = DriveApp.getFileById(id);
    var exported = DownloadsFiles.EXPORTS[String(file.getMimeType())];
    var own = String(file.getName()).match(OWN_EXT_);
    var ext = '';
    if (exported) ext = exported[0];
    else if (own) ext = own[1].toLowerCase();
    return put_(s, file, base + (ext ? '.' + ext : ''));
  }

  /**
   * Saves the files of one folder and queues its subfolders.
   *
   * @param {!Object} s The saver.
   * @param {!Array<!Object>} queue The folders left, each with its `rel`
   *     path; the subfolders are added.
   * @param {!Object} at The folder and its `rel` path.
   * @param {string} base Where the team's things go.
   * @return {boolean} False when the budget is spent.
   */
  function saveFolderFiles_(s, queue, at, base) {
    var files = at.folder.getFiles();
    var done = true;
    var f;
    var ex;
    var sub;
    while (files.hasNext() && done) {
      f = files.next();
      ex = DownloadsFiles.EXPORTS[String(f.getMimeType())];
      done = put_(
        s,
        f,
        base +
          '/' +
          at.rel +
          DownloadsFiles.fileName(f.getName(), ex ? ex[0] : '')
      );
    }
    var subs = at.folder.getFolders();
    while (subs.hasNext()) {
      sub = subs.next();
      queue.push({
        folder: sub,
        rel: at.rel + DownloadsFiles.safeName(sub.getName(), 'folder') + '/'
      });
    }
    return done;
  }

  /**
   * Saves a team's folder and every subfolder, until the budget is spent.
   *
   * @param {!Object} s The saver.
   * @param {string} id The id of the folder.
   * @param {string} base Where the team's things go.
   * @return {boolean} False when the budget is spent.
   */
  function saveFolder_(s, id, base) {
    var queue = [{ folder: DriveApp.getFolderById(id), rel: '' }];
    var done = true;
    while (queue.length && done) {
      done = saveFolderFiles_(s, queue, queue.shift(), base);
    }
    return done;
  }

  /**
   * Notes a team whose link is missing or is not a Drive link.
   *
   * @param {!Object} s The saver.
   * @param {!Object} team The team.
   * @param {string} base Where the team's things go.
   */
  function missLink_(s, team, base) {
    if (s.failed[base]) return;
    var reason = team.link
      ? 'The link is not a Google Drive link'
      : 'No link was given';
    miss_(s, base, reason, '');
  }

  /**
   * Saves one team's file or folder, as far as one request may.
   *
   * @param {!Object} form The form.
   * @param {!Object} job The job.
   * @param {*} ref The reference of the team.
   * @return {{done: boolean, saved: number}} Whether every file is in, and
   *     how many this request saved.
   * @throws {ApiError} `submission_not_found` when the team is gone.
   */
  function saveTeam(form, job, ref) {
    var team = TeamsService.teamBlocks(form).filter(function (t) {
      return t.ref === ref;
    })[0];
    if (!team) {
      ApiError.fail('submission_not_found', 'That team no longer exists.');
    }
    var base = DownloadsJobs.teamBase(form, team);
    var s = saver_(job, team);
    var link = team.link ? Rules.parseDriveLink(team.link) : { ok: false };
    if (!link.ok) {
      missLink_(s, team, base);
      DownloadsJobs.save(job);
      return { done: true, saved: 0 };
    }
    s.saved = DownloadsJobs.savedFiles(job.folder);
    var done;
    try {
      done =
        link.kind === 'folder'
          ? saveFolder_(s, link.id, base)
          : saveFile_(s, link.id, base);
    } catch (e) {
      if (!s.failed[base]) {
        miss_(s, base, 'The link could not be opened: ' + e.message);
      }
      done = true;
    }
    DownloadsJobs.save(job);
    return { done: done, saved: s.savedNow };
  }

  return { saveTeam };
})();
