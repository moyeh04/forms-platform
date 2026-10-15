/** A Download all job: its folder, its saved parts and where a team goes. */

var DownloadsJobs = (function () {
  /** The most bytes in one zip part: 40 MB. */
  var PART_BYTES = 41943040;

  /** The most time one request spends saving files. */
  var BUDGET_MS = 25000;

  /** The most files one request saves. */
  var FILES_PER_CALL = 40;

  /** The bytes of one piece of a zip the page reads: 3 MB. */
  var CHUNK_BYTES = 3145728;

  /** How long a job is kept between requests, in seconds: six hours. */
  var JOB_SECONDS_ = 21600;

  /** The smallest team number that needs no leading zero. */
  var TWO_DIGITS_ = 10;

  /**
   * Gives where a team's things go inside the zip: "Tasks/03 - Task 3" or
   * "Projects/03 - Library System".
   *
   * @param {!Object} form The form.
   * @param {!Object} team The team, with its `number`, `title` and `ref`.
   * @return {string} The path.
   */
  function teamBase(form, team) {
    var top = form.type === FormType.TASK_SUBMISSION ? 'Tasks/' : 'Projects/';
    var n = team.number;
    var number = n < TWO_DIGITS_ ? '0' + n : String(n);
    return top + number + ' - ' + DownloadsFiles.safeName(team.title, team.ref);
  }

  /**
   * Finds the Downloads folder under Exports, making it when missing.
   *
   * @return {!DriveApp.Folder} The folder.
   */
  function downloadsFolder() {
    var exp = PrintService.exportsFolder();
    var it = exp.getFoldersByName('Downloads');
    return it.hasNext() ? it.next() : exp.createFolder('Downloads');
  }

  /**
   * Loads the job a request names.
   *
   * @param {!Object} req The request body, with the form and the `job`.
   * @return {{form: !Object, job: !Object}} The form and the job, with its
   *     `id` and work `folder`.
   * @throws {ApiError} `download_gone` when the job expired.
   */
  function load(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    var raw = CacheService.getScriptCache().get(
      Constants.CACHE.DL_JOB_PREFIX + req.job
    );
    var job = raw ? Json.parseJson(raw, null) : null;
    if (!job || job.form !== form.id) {
      ApiError.fail(
        'download_gone',
        'This download has expired. Start it again.'
      );
    }
    job.id = req.job;
    job.folder = DriveApp.getFolderById(job.folderId);
    return { form: form, job: job };
  }

  /**
   * Keeps a job for the next request.
   *
   * @param {!Object} job The job.
   */
  function save(job) {
    var keep = {
      form: job.form,
      folderId: job.folderId,
      failed: job.failed || [],
      zips: job.zips || [],
      parts: job.parts || []
    };
    CacheService.getScriptCache().put(
      Constants.CACHE.DL_JOB_PREFIX + job.id,
      JSON.stringify(keep),
      JOB_SECONDS_
    );
  }

  /**
   * Lists the files already saved in the job folder, so a repeated request
   * skips them.
   *
   * @param {!DriveApp.Folder} folder The work folder.
   * @return {!Object<string, !DriveApp.File>} The files by name.
   */
  function savedFiles(folder) {
    var names = {};
    var it = folder.getFiles();
    var f;
    while (it.hasNext()) {
      f = it.next();
      names[f.getName()] = f;
    }
    return names;
  }

  return {
    PART_BYTES,
    BUDGET_MS,
    FILES_PER_CALL,
    CHUNK_BYTES,
    teamBase,
    downloadsFolder,
    load,
    save,
    savedFiles
  };
})();
