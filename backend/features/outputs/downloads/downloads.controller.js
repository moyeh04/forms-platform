/**
 * Download everything a team or task form collected: each team's task file or project folder,
 * with a Teams.xlsx that lists the teams and links each one to its files, packed in zip parts.
 *
 * The files are read inside Google as the owner (DriveApp, and the export address with the
 * owner's token for Google Slides, Docs and Sheets), not through public download links, so the
 * limits Google puts on anonymous downloads do not apply. What is left is Apps Script's own:
 * six minutes a request and about 50 MB a file. So the page asks for one team at a time, a
 * big folder is fetched over several requests, and each zip part stays under 40 MB.
 *
 * The work happens in a folder of the owner's Drive (Forms Platform / Exports / Downloads). Only
 * the zips stay there; the page then reads them in pieces through the API, so nothing is shared.
 */

var DownloadsController = (function () {
  /**
   * Starts a download: a fresh work folder (the form's older ones go to the trash) and the list of teams.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function start(req) {
    var form = FormsRepository.requireForm(req.slug || req.id);
    if (!TeamsService.isTeamForm(form))
      ApiError.fail(
        'wrong_type',
        'Only team and task forms can be downloaded.'
      );
    var teams = TeamsService.teamBlocks(form);
    if (!teams.length)
      ApiError.fail('nothing_to_download', 'Nobody has registered yet.');
    var downloads = DownloadsJobs.dlDownloadsFolder();
    var old = downloads.getFolders();
    while (old.hasNext()) {
      var f = old.next();
      if (String(f.getName()).indexOf(form.slug + ' ') === 0)
        f.setTrashed(true);
    }
    var folder = downloads.createFolder(
      form.slug + ' ' + Time.nowIso().slice(0, 16).replace('T', ' ')
    );
    var job = {
      id: folder.getId(),
      form: form.id,
      folderId: folder.getId(),
      failed: []
    };
    DownloadsJobs.dlSave(job);
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
   * Saves one team's file, or its folder with every subfolder. A big folder is saved over several
   * requests: `done` is false until every file is in, and a repeated request skips what is saved.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function downloadTeam(req) {
    var x = DownloadsJobs.dlJob(req),
      form = x.form,
      job = x.job;
    var team = TeamsService.teamBlocks(form).filter(function (t) {
      return t.ref === req.ref;
    })[0];
    if (!team)
      ApiError.fail('submission_not_found', 'That team no longer exists.');
    var base = DownloadsJobs.dlBase(form, team);
    var miss = function (path, reason, url) {
      job.failed.push({
        number: team.number,
        title: team.title,
        path: path,
        reason: reason,
        url: url || team.link
      });
    };
    var failedPaths = {};
    job.failed.forEach(function (f) {
      failedPaths[f.path] = true;
    });
    var link = team.link ? Rules.parseDriveLink(team.link) : { ok: false };
    if (!link.ok) {
      if (!failedPaths[base])
        miss(
          base,
          team.link
            ? 'The link is not a Google Drive link'
            : 'No link was given',
          ''
        );
      DownloadsJobs.dlSave(job);
      return { done: true, saved: 0 };
    }

    var saved = DownloadsJobs.dlSaved(job.folder);
    var started = Date.now(),
      count = 0,
      savedNow = 0;
    var put = function (file, path) {
      if (saved[path] || failedPaths[path]) return true;
      if (
        count >= DownloadsJobs.DL_FILES_PER_CALL ||
        Date.now() - started > DownloadsJobs.DL_BUDGET_MS
      )
        return false;
      count++;
      var got;
      try {
        got = DownloadsJobs.dlBlob(file);
      } catch (e) {
        got = { reason: 'Could not be read: ' + e.message };
      }
      if (got.reason) {
        miss(path, got.reason, file.getUrl ? file.getUrl() : team.link);
        failedPaths[path] = true;
        return true;
      }
      job.folder.createFile(got.blob.setName(path));
      saved[path] = true;
      savedNow++;
      return true;
    };

    var done = true;
    try {
      if (link.kind !== 'folder') {
        var file = DriveApp.getFileById(link.id);
        var export_ = DownloadsJobs.DL_EXPORTS[String(file.getMimeType())];
        var own = String(file.getName()).match(/\.([A-Za-z0-9]{1,5})$/);
        var ext = export_ ? export_[0] : own ? own[1].toLowerCase() : '';
        done = put(file, base + (ext ? '.' + ext : ''));
      } else {
        var queue = [{ folder: DriveApp.getFolderById(link.id), rel: '' }];
        while (queue.length && done) {
          var at = queue.shift();
          var files = at.folder.getFiles();
          while (files.hasNext() && done) {
            var f = files.next();
            var ex = DownloadsJobs.DL_EXPORTS[String(f.getMimeType())];
            done = put(
              f,
              base +
                '/' +
                at.rel +
                DownloadsJobs.dlFileName(f.getName(), ex ? ex[0] : '')
            );
          }
          var subs = at.folder.getFolders();
          while (subs.hasNext()) {
            var s = subs.next();
            queue.push({
              folder: s,
              rel: at.rel + DownloadsJobs.dlName(s.getName(), 'folder') + '/'
            });
          }
        }
      }
    } catch (e) {
      if (!failedPaths[base])
        miss(base, 'The link could not be opened: ' + e.message);
      done = true;
    }
    DownloadsJobs.dlSave(job);
    return { done: done, saved: savedNow };
  }

  /**
   * Writes the workbook and splits the saved files into zip parts. Returns how many parts there are.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function finish(req) {
    var x = DownloadsJobs.dlJob(req),
      form = x.form,
      job = x.job;
    var saved = DownloadsJobs.dlSaved(job.folder);
    Object.keys(saved).forEach(function (n) {
      if (/\.zip$/.test(n) && !/\//.test(n)) delete saved[n];
    });
    delete saved['Teams.xlsx'];
    var book = job.folder.createFile(
      DownloadsWorkbook.dlWorkbook(form, job, saved).setName('Teams.xlsx')
    );
    var parts = [[book.getId()]],
      size = book.getSize();
    Object.keys(saved)
      .sort()
      .forEach(function (name) {
        var f = saved[name],
          s = f.getSize();
        if (
          size + s > DownloadsJobs.DL_PART_BYTES &&
          parts[parts.length - 1].length
        ) {
          parts.push([]);
          size = 0;
        }
        parts[parts.length - 1].push(f.getId());
        size += s;
      });
    job.parts = parts;
    job.zips = [];
    DownloadsJobs.dlSave(job);
    return {
      parts: parts.length,
      files: Object.keys(saved).length,
      failed: job.failed
    };
  }

  /**
   * Packs one zip part, keeps it in the work folder, and moves its loose files to the trash.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function pack(req) {
    var x = DownloadsJobs.dlJob(req),
      form = x.form,
      job = x.job;
    var i = parseInt(req.part, 10);
    if (!(i >= 0 && i < job.parts.length))
      ApiError.fail('bad_part', 'That part does not exist.');
    var root = DownloadsJobs.dlName(form.title, form.slug);
    var files = job.parts[i].map(function (id) {
      return DriveApp.getFileById(id);
    });
    var blobs = files.map(function (f) {
      return f.getBlob().setName(root + '/' + f.getName());
    });
    var name =
      root +
      (job.parts.length > 1
        ? ' - part ' + (i + 1) + ' of ' + job.parts.length
        : '') +
      '.zip';
    var zip = job.folder.createFile(Utilities.zip(blobs, name));
    files.forEach(function (f) {
      f.setTrashed(true);
    });
    job.zips[i] = zip.getId();
    DownloadsJobs.dlSave(job);
    return { file: zip.getId(), name: name, size: zip.getSize() };
  }

  /**
   * A piece of a packed zip, as base64, so the page can save it without sharing anything. Only
   * the piece is read from Drive (a ranged request), not the whole zip each time.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function chunk(req) {
    var job = DownloadsJobs.dlJob(req).job;
    if (job.zips.indexOf(req.file) === -1)
      ApiError.fail('bad_part', 'That part does not exist.');
    var size = DriveApp.getFileById(req.file).getSize();
    var from = Math.max(0, parseInt(req.offset, 10) || 0);
    var to = Math.min(size, from + DownloadsJobs.DL_CHUNK_BYTES);
    var resp = DownloadsJobs.dlRetry(function () {
      var r = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + req.file + '?alt=media',
        {
          headers: {
            Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
            Range: 'bytes=' + from + '-' + (to - 1)
          },
          muteHttpExceptions: true
        }
      );
      var code = r.getResponseCode();
      if (code === 429 || code >= 500) throw new Error('429 try again');
      if (code !== 206 && code !== 200)
        ApiError.fail(
          'download_failed',
          'Drive would not give the file (' + code + '). Try again.'
        );
      return r;
    });
    return {
      data: Utilities.base64Encode(resp.getContent()),
      size: size,
      next: to < size ? to : null
    };
  }

  return { start, downloadTeam, finish, pack, chunk };
})();
