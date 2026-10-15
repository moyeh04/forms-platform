/**
 * The progress of teams: a mark on one milestone of one team, saved inside
 * the lock and only in its own cell, the counts of marks the Setup tab
 * warns with, and what a team sees with its key.
 */

var ProgressService = (function () {
  /** The sentence of each reason a mark is refused. */
  var REFUSED_ = {
    bad_milestone: 'This form has no such milestone.',
    bad_state: 'A milestone is Not yet, Submitted or Discussed.',
    note_too_long:
      'A note can have up to ' + Rules.PROGRESS_NOTE_MAX + ' characters.'
  };

  /**
   * Reads the change a mark asks for: the fields it sends, each optional.
   *
   * @param {!Object} req The request body.
   * @return {!Object} `state`, `teamNote` and `privateNote`, when sent.
   */
  function changeOf_(req) {
    var out = {};
    ['state', 'teamNote', 'privateNote'].forEach(function (k) {
      if (req[k] !== undefined && req[k] !== null) out[k] = String(req[k]);
    });
    return out;
  }

  /**
   * Finds a team that is not cancelled.
   *
   * @param {!Object} form The form.
   * @param {*} id The id of the team.
   * @return {!Object} The team.
   * @throws {ApiError} `submission_not_found`.
   */
  function liveTeam_(form, id) {
    var r = ResponsesRepository.readResponses(form).filter(function (x) {
      return x.id === String(id || '');
    })[0];
    if (!r) {
      ApiError.fail(
        'submission_not_found',
        'This team is no longer registered.'
      );
    }
    return r;
  }

  /**
   * Marks one milestone of one team. The team is read again inside the
   * lock, so two marks on two milestones of one team both stay; a mark
   * made on a state that changed since the page read it is refused with the
   * marks as they are now.
   *
   * @param {!Object} form The form.
   * @param {!Object} req The request: `submissionId`, `milestone`, `state`,
   *     `teamNote`, `privateNote` and `baseAt`.
   * @param {string} by Who marks: "a" or "c:<link id>".
   * @param {function(!Object): !Object} shape What the caller may see of
   *     the marks.
   * @return {!Object} The marks of the team after the change, shaped.
   * @throws {ApiError} `bad_milestone`, `bad_state`, `note_too_long`,
   *     `submission_not_found` or `changed_meanwhile`.
   */
  function mark_(form, req, by, shape) {
    var id = String(req.milestone || '');
    var change = changeOf_(req);
    var why = Rules.markProblem(form, id, change);
    if (why) ApiError.fail(why, REFUSED_[why]);
    return Lock.withLock(function () {
      var r = liveTeam_(form, req.submissionId);
      if (Rules.markStale(r.progress, id, req.baseAt)) {
        ApiError.fail(
          'changed_meanwhile',
          'Someone else marked this milestone a moment ago. It now shows' +
            ' their mark.',
          { progress: shape(r.progress) }
        );
      }
      r.progress = Rules.applyMark(r.progress, id, change, {
        at: Time.nowIso(),
        by: by
      });
      ResponsesRepository.writeProgress(form, r);
      return shape(r.progress);
    });
  }

  /**
   * Counts the teams with a mark on each milestone, so the Setup tab can
   * say what a change of milestones hides.
   *
   * @param {!Object} form The form.
   * @return {!Object<string, number>} The counts, by milestone id.
   */
  function markCounts_(form) {
    return Rules.markCounts(
      ResponsesRepository.readResponses(form).map(function (r) {
        return r.progress;
      })
    );
  }

  /**
   * Gives a team its progress with its key, even an expired one: the marks
   * are only read, and the answers stay behind a key that still works.
   *
   * @param {!Object} form The form.
   * @param {*} key The edit key.
   * @return {?Array<!Object>} The line of each milestone, or null when the
   *     form does not show teams their progress.
   */
  function mine_(form, key) {
    var r = KeysService.findByKey(form, key, true);
    if (!Rules.progressForStudents(form)) return null;
    return Rules.studentProgress(form, r.progress);
  }

  return { mark: mark_, markCounts: markCounts_, mine: mine_ };
})();
