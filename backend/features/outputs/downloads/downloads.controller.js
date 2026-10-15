/**
 * Download everything a team or task form collected: each team's task file or
 * project folder, with a Teams.xlsx that lists the teams and links each one to
 * its files, packed in zip parts.
 *
 * The files are read inside Google as the owner (DriveApp, and the export
 * address with the owner's token for Google Slides, Docs and Sheets), not
 * through public download links, so the limits Google puts on anonymous
 * downloads do not apply. What is left is Apps Script's own: six minutes a
 * request and about 50 MB a file. So the page asks for one team at a time, a
 * big folder is fetched over several requests, and each zip part stays under 40
 * MB.
 *
 * The work happens in a folder of the owner's Drive (Forms Platform / Exports /
 * Downloads). Only the zips stay there; the page then reads them in pieces
 * through the API, so nothing is shared.
 */

var DownloadsController = (function () {
  /**
   * Answers the `admin.download.start` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function start(req) {
    return DownloadsService.start(FormsService.requireForm(req.slug || req.id));
  }

  /**
   * Answers the `admin.download.team` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function downloadTeam(req) {
    var x = DownloadsJobs.load(req);
    return DownloadsTeam.saveTeam(x.form, x.job, req.ref);
  }

  /**
   * Answers the `admin.download.finish` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function finish(req) {
    var x = DownloadsJobs.load(req);
    return DownloadsService.finish(x.form, x.job);
  }

  /**
   * Answers the `admin.download.pack` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function pack(req) {
    var x = DownloadsJobs.load(req);
    return DownloadsService.pack(x.form, x.job, req.part);
  }

  /**
   * Answers the `admin.download.chunk` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function chunk(req) {
    var job = DownloadsJobs.load(req).job;
    return DownloadsService.chunk(job, req.file, req.offset);
  }

  return { start, downloadTeam, finish, pack, chunk };
})();
