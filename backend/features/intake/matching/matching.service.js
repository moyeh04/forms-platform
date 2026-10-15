/**
 * WhatsApp matching. WhatsApp has no free way to read pending join requests,
 * so a reviewer pastes the numbers and the platform matches them, by
 * normalized phone, to what each student submitted.
 */

var MatchingService = (function () {
  /**
   * Reads a form that has matching turned on.
   *
   * @param {*} ref The slug or id of the form.
   * @return {!Object} The form.
   * @throws {ApiError} `no_matching` when matching is off for the form.
   */
  function requireMatchingForm_(ref) {
    var form = FormsRepository.requireForm(ref);
    if (!form.matching?.enabled)
      ApiError.fail('no_matching', 'Matching is not turned on for this form.');
    return form;
  }

  /**
   * Makes the label of a pasted line: the line without the number in it.
   *
   * @param {string} line The pasted line.
   * @param {string} raw The number as it was written in the line.
   * @return {string} The rest of the line, its separators made spaces.
   */
  function labelOf_(line, raw) {
    return line
      .split(raw)
      .join(' ')
      .replace(/[\s,;:|\-]+/g, ' ')
      .trim();
  }

  /**
   * Adds the numbers of pasted text as requests, skipping those the form
   * has already.
   *
   * @param {!Object} form The form.
   * @param {*} text The pasted text, one or more numbers on each line.
   * @return {{added: number, duplicates: number, unparsed: !Array<string>}}
   *     How many were added and skipped, and the lines with no number.
   */
  function importNumbers_(form, text) {
    return Lock.withLock(function () {
      var have = {};
      MatchingRepository.readRequests(form).forEach(function (r) {
        have[r.phone] = true;
      });
      var fresh = [];
      var duplicates = 0;
      var unparsed = [];
      String(text || '')
        .split(/\r?\n/)
        .forEach(function (line) {
          line = line.trim();
          if (!line) return;
          var phones = Rules.extractPhones(line);
          if (!phones.length) {
            unparsed.push(line);
            return;
          }
          phones.forEach(function (p) {
            if (have[p.phone]) {
              duplicates++;
              return;
            }
            have[p.phone] = true;
            fresh.push({
              id: Crypto.uuid(),
              raw: line,
              phone: p.phone,
              label: labelOf_(line, p.raw),
              added: Time.nowIso(),
              decision: ReviewStatus.PENDING,
              note: ''
            });
          });
        });
      MatchingRepository.addRequests(form, fresh);
      return {
        added: fresh.length,
        duplicates: duplicates,
        unparsed: unparsed
      };
    });
  }

  /**
   * Names how a request matches the submissions.
   *
   * @param {number} count How many submissions have its number.
   * @return {string} `none`, `matched` or `duplicate`.
   */
  function matchStatus_(count) {
    if (count === 0) return 'none';
    return count === 1 ? 'matched' : 'duplicate';
  }

  /**
   * Matches the requests of a form to its submissions by phone.
   *
   * @param {!Object} form The form.
   * @return {{requests: !Array<!Object>, submissions: !Array<!Object>,
   *     notRequested: !Array<string>}} Each request with the ids it
   *     matches, the submissions, and the ids of submissions no request
   *     names.
   */
  function matchList_(form) {
    var subs = ResponsesRepository.readResponses(form);
    var byPhone = {};
    subs.forEach(function (r) {
      var p = Rules.normalizePhone(r.phone);
      if (!p) return;
      byPhone[p] = byPhone[p] || [];
      byPhone[p].push(r.id);
    });
    var requested = {};
    var requests = MatchingRepository.readRequests(form).map(function (q) {
      requested[q.phone] = true;
      var ids = byPhone[q.phone] || [];
      return {
        id: q.id,
        phone: q.phone,
        label: q.label,
        added: q.added,
        decision: q.decision,
        note: q.note,
        matches: ids,
        status: matchStatus_(ids.length)
      };
    });
    var notRequested = subs
      .filter(function (r) {
        return !requested[Rules.normalizePhone(r.phone)];
      })
      .map(function (r) {
        return r.id;
      });
    return {
      requests: requests,
      submissions: subs,
      notRequested: notRequested
    };
  }

  /**
   * Records the decision on a request. When the form has the matching review
   * step and exactly one submission has the number, the step of that
   * submission takes the decision too.
   *
   * @param {!Object} form The form.
   * @param {*} requestId The id of the request.
   * @param {string} decision A review status.
   * @param {*} note A note to store, or undefined to keep the old one.
   * @return {?string} The id of the submission it changed, or null.
   * @throws {ApiError} `request_not_found` when there is no such request.
   */
  function decide_(form, requestId, decision, note) {
    var stepId = form.matching.step || 'group';
    var hasStep = (form.review?.steps || []).some(function (s) {
      return s.id === stepId;
    });
    var linked = null;
    Lock.withLock(function () {
      var q = MatchingRepository.readRequests(form).filter(function (x) {
        return x.id === requestId;
      })[0];
      if (!q)
        ApiError.fail('request_not_found', 'That request does not exist.');
      var subs = ResponsesRepository.readResponses(form).filter(function (r) {
        return Rules.normalizePhone(r.phone) === q.phone;
      });
      if (hasStep && subs.length === 1) {
        ResponsesReview.setReviewStep(form, subs[0], stepId, decision);
        ResponsesRepository.saveResponse(form, subs[0]);
        linked = subs[0].id;
      }
      q.decision = decision;
      if (note !== undefined) q.note = String(note);
      MatchingRepository.saveRequest(form, q);
    });
    return linked;
  }

  /**
   * Deletes requests by id.
   *
   * @param {!Object} form The form.
   * @param {!Array<string>} requestIds The ids; unknown ones are skipped.
   * @return {number} How many it deleted.
   */
  function remove_(form, requestIds) {
    var ids = {};
    requestIds.forEach(function (i) {
      ids[i] = true;
    });
    return Lock.withLock(function () {
      var gone = MatchingRepository.readRequests(form).filter(function (q) {
        return ids[q.id];
      });
      MatchingRepository.deleteRequests(form, gone);
      return gone.length;
    });
  }

  return {
    requireMatchingForm: requireMatchingForm_,
    importNumbers: importNumbers_,
    matchList: matchList_,
    decide: decide_,
    remove: remove_
  };
})();
