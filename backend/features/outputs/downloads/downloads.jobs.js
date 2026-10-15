/** A Download all job: its folder, its saved parts, retries and file names. */

var DownloadsJobs = (function () {
var DL_PART_BYTES_ = 40 * 1024 * 1024;

var DL_FILE_MAX_ = 45 * 1024 * 1024;

var DL_BUDGET_MS_ = 25000;

var DL_FILES_PER_CALL_ = 40;

var DL_CHUNK_BYTES_ = 3 * 1024 * 1024;

var DL_JOB_SECONDS_ = 6 * 3600;

/** Google files are saved in the matching Office format. */
var DL_EXPORTS_ = {
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

/** A name that is safe in a zip on any computer. */
function dlName_(text, fallback) {
  var s = String(text || '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return (s || fallback || 'file').slice(0, 80).trim();
}

function dlPad_(n) {
  return n < 10 ? '0' + n : String(n);
}

/** Where a team's things go inside the zip: "Tasks/03 - Task 3" or "Projects/03 - Library System". */
function dlBase_(form, team) {
  return (
    (form.type === 'task_submission' ? 'Tasks/' : 'Projects/') +
    dlPad_(team.number) +
    ' - ' +
    dlName_(team.title, team.ref)
  );
}

function dlDownloadsFolder_() {
  var exp = PrintService.exportsFolder();
  var it = exp.getFoldersByName('Downloads');
  return it.hasNext() ? it.next() : exp.createFolder('Downloads');
}

function dlJob_(req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var raw = CacheService.getScriptCache().get('dl_job:' + req.job);
  var job = raw ? Json.parseJson(raw, null) : null;
  if (!job || job.form !== form.id)
    ApiError.fail('download_gone', 'This download has expired. Start it again.');
  job.id = req.job;
  job.folder = DriveApp.getFolderById(job.folderId);
  return { form: form, job: job };
}

function dlSave_(job) {
  var keep = {
    form: job.form,
    folderId: job.folderId,
    failed: job.failed || [],
    zips: job.zips || [],
    parts: job.parts || []
  };
  CacheService.getScriptCache().put(
    'dl_job:' + job.id,
    JSON.stringify(keep),
    DL_JOB_SECONDS_
  );
}

/** Names of the files already saved in the job folder, so a repeated request skips them. */
function dlSaved_(folder) {
  var names = {};
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    names[f.getName()] = f;
  }
  return names;
}

function dlRetry_(fn) {
  var wait = 1000;
  for (var i = 0; ; i++) {
    try {
      return fn();
    } catch (e) {
      var busy = /rate|too many|quota|429|503|try again|backend error/i.test(
        String(e.message)
      );
      if (!busy || i >= 3) throw e;
      Utilities.sleep(wait);
      wait *= 2;
    }
  }
}

/** The file's bytes and the extension to save it with, or a reason it cannot be saved. */
function dlBlob_(file) {
  var mime = String(file.getMimeType());
  var ex = DL_EXPORTS_[mime];
  if (ex) {
    var resp = dlRetry_(function () {
      var r = UrlFetchApp.fetch(ex[1].replace('{id}', file.getId()), {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      var code = r.getResponseCode();
      if (code === 429 || code >= 500) throw new Error('429 try again');
      return r;
    });
    if (resp.getResponseCode() !== 200)
      return {
        reason: 'Google would not export it (' + resp.getResponseCode() + ')'
      };
    return { blob: resp.getBlob(), ext: ex[0] };
  }
  if (mime.indexOf('application/vnd.google-apps.') === 0)
    return { reason: 'This kind of Google file cannot be downloaded' };
  var size = file.getSize();
  if (size > DL_FILE_MAX_)
    return {
      reason:
        'Too big to pack (' +
        Math.round(size / 1048576) +
        ' MB): open it in Drive'
    };
  return {
    blob: dlRetry_(function () {
      return file.getBlob();
    }),
    ext: ''
  };
}

/** "Slides.pptx" stays, "Slides" exported as pptx becomes "Slides.pptx". */
function dlFileName_(name, ext) {
  var n = dlName_(name);
  return ext && !new RegExp('\\.' + ext + '$', 'i').test(n) ? n + '.' + ext : n;
}

return { dlDownloadsFolder: dlDownloadsFolder_, dlSave: dlSave_, dlJob: dlJob_, dlBase: dlBase_, dlSaved: dlSaved_, DL_FILES_PER_CALL: DL_FILES_PER_CALL_, DL_BUDGET_MS: DL_BUDGET_MS_, dlBlob: dlBlob_, DL_EXPORTS: DL_EXPORTS_, dlFileName: dlFileName_, dlName: dlName_, DL_PART_BYTES: DL_PART_BYTES_, DL_CHUNK_BYTES: DL_CHUNK_BYTES_, dlRetry: dlRetry_ };
})();
