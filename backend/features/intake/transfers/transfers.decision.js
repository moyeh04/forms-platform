/**
 * The answer to a transfer request: a rejection, or an approval that moves
 * the member, hands over the lead when the leader moves, and closes the
 * other requests for the same student.
 */

var TransferDecision = (function () {
  /**
   * Finds a waiting request.
   *
   * @param {!Array<!Object>} all Every request.
   * @param {*} id The id of the request.
   * @param {string} fromId The team a leader answers for; empty for the
   *     admin, who may answer any request.
   * @return {!Object} The request.
   * @throws {ApiError} `transfer_gone` when it is not waiting.
   */
  function requirePending_(all, id, fromId) {
    var t = all.filter(function (x) {
      return x.id === String(id) && x.status === 'pending';
    })[0];
    if (!t || (fromId && t.fromId !== fromId)) {
      ApiError.fail('transfer_gone', 'This request was already answered.');
    }
    return t;
  }

  /**
   * Finds the team that asked, closing the request when it is gone.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The live registrations.
   * @param {!Object} t The request.
   * @return {!Object} The team.
   * @throws {ApiError} `transfer_gone` when the team no longer exists.
   */
  function requireAsker_(form, rows, t) {
    var to = rows.filter(function (r) {
      return r.id === t.toId;
    })[0];
    if (!to) {
      t.status = 'closed';
      TransfersRepository.saveTransfer(form, t);
      ApiError.fail('transfer_gone', 'The team that asked no longer exists.');
    }
    return to;
  }

  /**
   * Says whether a list of members holds the student of a request.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} list The members.
   * @param {!Object} t The request.
   * @return {boolean} True when the student is in it.
   */
  function holds_(form, list, t) {
    var codeId = TransferMembers.codeId(form);
    return list.some(function (m) {
      return String(m[codeId]) === t.code;
    });
  }

  /**
   * Refuses a request when the team that asked is full.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} toList The members of the team that asked.
   * @param {!Object} t The request.
   * @throws {ApiError} `transfer_full` when there is no room.
   */
  function checkRoom_(form, toList, t) {
    var mf = Rules.fieldByRole(form, 'members');
    var most = mf.max == null ? Rules.teamSizeRange(form).max - 1 : mf.max;
    if (!holds_(form, toList, t) && toList.length >= most) {
      ApiError.fail('transfer_full', 'The team that asked is full now.');
    }
  }

  /**
   * Saves a team after its members changed.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The registration.
   */
  function saveTeam_(form, r) {
    TransferMembers.setTeamSize(form, r.data);
    ResponsesRepository.applyDerived(form, r);
    ResponsesRepository.saveResponse(form, r);
  }

  /**
   * Takes the student out of every team but the one that asked.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The live registrations.
   * @param {!Object} t The request.
   * @param {!Object} answer The answer, with `next`: who leads a team
   *     whose leader moves.
   * @return {{underMin: boolean, handed: boolean}} Whether a team is now
   *     under its smallest size, and whether a leader moved.
   */
  function takeFromOthers_(form, rows, t, answer) {
    var mf = Rules.fieldByRole(form, 'members');
    var codeId = TransferMembers.codeId(form);
    var min = Rules.teamSizeRange(form).min;
    var out = { underMin: false, handed: false };
    rows.forEach(function (r) {
      if (r.id === t.toId) return;
      var mine = Rules.membersOf(form, r.data).filter(function (m) {
        return m.code === t.code;
      })[0];
      if (!mine) return;
      if (mine.leader) {
        TransferMembers.handOver(form, r.data, answer.next);
        out.handed = true;
      } else {
        r.data[mf.id] = (r.data[mf.id] || []).filter(function (m) {
          return String(m[codeId]) !== t.code;
        });
      }
      TransferMembers.setTeamSize(form, r.data);
      out.underMin = out.underMin || r.data[mf.id].length + 1 < min;
      ResponsesRepository.applyDerived(form, r);
      ResponsesRepository.saveResponse(form, r);
    });
    return out;
  }

  /**
   * Closes the other waiting requests for the same student, who has moved.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} all Every request.
   * @param {!Object} t The approved request.
   */
  function closeOthers_(form, all, t) {
    all.forEach(function (x) {
      if (x.id !== t.id && x.status === 'pending' && x.code === t.code) {
        x.status = 'closed';
        TransfersRepository.saveTransfer(form, x);
      }
    });
  }

  /**
   * Moves the student of a request to the team that asked.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} all Every request.
   * @param {!Object} t The request.
   * @param {!Object} answer The answer: `by` and `next`.
   * @return {{transfer: !Object, underMin: boolean, handed: boolean}} The
   *     approved request and what the move did.
   */
  function approve_(form, all, t, answer) {
    var rows = ResponsesRepository.readResponses(form);
    var to = requireAsker_(form, rows, t);
    var toList = TransferMembers.listOf(form, to.data);
    checkRoom_(form, toList, t);
    var moved = takeFromOthers_(form, rows, t, answer);
    if (!holds_(form, toList, t)) {
      to.data[Rules.fieldByRole(form, 'members').id] = toList.concat([
        t.member
      ]);
      saveTeam_(form, to);
    }
    t.status = 'approved';
    t.decidedBy = answer.by;
    TransfersRepository.saveTransfer(form, t);
    closeOthers_(form, all, t);
    return { transfer: t, underMin: moved.underMin, handed: moved.handed };
  }

  /**
   * Answers a request. A leader may answer only a request for a member of
   * their own team.
   *
   * @param {!Object} form The form as it validates.
   * @param {*} id The id of the request.
   * @param {{approve: boolean, by: string, fromId: string, next: *}} answer
   *     Whether it is approved; `leader` or `admin`; the team a leader
   *     answers for, empty for the admin; and `{leader, email}`, who leads
   *     the team after a leader that moves.
   * @return {{transfer: !Object, underMin: boolean, handed: boolean}} The
   *     request, whether a team is under its smallest size, and whether a
   *     leader moved.
   * @throws {ApiError} `transfer_gone`, `transfer_full` or a hand-over
   *     error.
   */
  function decide(form, id, answer) {
    var all = TransfersRepository.readTransfers(form);
    var t = requirePending_(all, id, answer.fromId);
    if (answer.approve) return approve_(form, all, t, answer);
    t.status = 'rejected';
    t.decidedBy = answer.by;
    return {
      transfer: TransfersRepository.saveTransfer(form, t),
      underMin: false,
      handed: false
    };
  }

  return { decide };
})();
