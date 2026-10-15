/**
 * Moving a student from one team to another team of the same form.
 *
 * A form that allows a student in only one team refuses a team that names a
 * member of another team. With `rules.transfers` on, the leader can ask for
 * that member instead: the team is saved without the member and a request is
 * recorded. The leader of the team that holds the member, or the admin,
 * approves or rejects it. An approval moves the member. The leaders see
 * requests when they open the form with their key; emails go out only with
 * `rules.transferEmails`.
 *
 * The leader of a team can be asked for as well. An approval then names the
 * member who leads the team next, so the team is never left without a leader. A
 * leader who is alone in a team has nobody to hand it to and cannot be asked
 * for.
 *
 * With `rules.transferPhones` the two leaders of a waiting request see each
 * other's phone, so they can talk before one of them answers.
 *
 * Requests are rows of the tab "Transfers" in the sheet of the form. The tab is
 * made with the first request, so a form that never has one keeps its sheet as
 * it is.
 */

var TransfersService = (function () {
  /**
   * Says, for each member code held by a team other than `selfId`, which
   * team holds it.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The live registrations.
   * @param {?string} selfId The id of the team being saved, if it exists.
   * @return {!Object<string, !Object>} By code: the team's `id` and `ref`,
   *     whether the member leads it, and whether they are `alone` in it.
   */
  function holdersOf_(form, rows, selfId) {
    var holders = {};
    rows.forEach(function (r) {
      if (r.id === selfId) return;
      var people = Rules.membersOf(form, r.data);
      people.forEach(function (m) {
        if (!m.code) return;
        holders[m.code] = {
          id: r.id,
          ref: r.ref,
          leader: m.leader,
          alone: people.length === 1
        };
      });
    });
    return holders;
  }

  /**
   * Refuses a team until its leader asks for every member another team
   * holds that can be moved, naming the ones that can.
   *
   * @param {!Array<!Object>} clash The members other teams hold.
   * @param {!Array<!Object>} movable Those that can be asked for.
   * @param {!Object} held The codes, holders and asked codes:
   *     `{codeId, holders, asked}`.
   * @throws {ApiError} `duplicate_member` unless all of them are asked for.
   */
  function refuseUnasked_(clash, movable, held) {
    var codeId = held.codeId;
    var asked = (held.asked || []).map(String);
    var askedAll =
      movable.length === clash.length &&
      movable.every(function (m) {
        return asked.indexOf(String(m[codeId])) !== -1;
      });
    if (askedAll) return;
    ApiError.fail(
      'duplicate_member',
      'Someone on this team is already registered in another team.',
      {
        codes: clash.map(function (m) {
          return m[codeId];
        }),
        transfer: movable.map(function (m) {
          var holder = held.holders[m[codeId]];
          return holder.leader
            ? { code: m[codeId], team: holder.ref, leader: true }
            : { code: m[codeId], team: holder.ref };
        })
      }
    );
  }

  /**
   * Takes the members that other teams hold out of a team's answers and
   * says which requests to record. A leader who is alone in a team cannot
   * be asked for: nobody would be left to lead it.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team, changed in place.
   * @param {!Array<!Object>} rows The live registrations.
   * @param {{selfId: ?string, asked: *}} ask The id of the team being
   *     saved, if it exists, and the codes its leader asks for.
   * @return {!Array<!Object>} The requests, for `recordTransfers`.
   * @throws {ApiError} `duplicate_member` until the leader asks for every
   *     member that can be moved.
   */
  function takeOutTransfers_(form, data, rows, ask) {
    if (!TransfersRepository.transfersOn(form)) return [];
    var mf = Rules.fieldByRole(form, 'members');
    var codeId = TransferMembers.codeId(form);
    var list = TransferMembers.listOf(form, data);
    var holders = holdersOf_(form, rows, ask.selfId);
    var clash = list.filter(function (m) {
      return holders[m[codeId]];
    });
    if (!clash.length) return [];
    var movable = clash.filter(function (m) {
      return !holders[m[codeId]].alone;
    });
    refuseUnasked_(clash, movable, {
      codeId: codeId,
      holders: holders,
      asked: ask.asked
    });
    data[mf.id] = list.filter(function (m) {
      return !holders[m[codeId]];
    });
    TransferMembers.setTeamSize(form, data);
    return movable.map(function (m) {
      return {
        code: String(m[codeId]),
        member: m,
        fromId: holders[m[codeId]].id,
        fromRef: holders[m[codeId]].ref
      };
    });
  }

  /**
   * Records one request for each wanted member, unless the same one is
   * already waiting.
   *
   * @param {!Object} form The form.
   * @param {!Object} team The team that asks.
   * @param {!Array<!Object>} wants The requests of `takeOutTransfers`.
   * @return {!Array<!Object>} The requests recorded.
   */
  function recordTransfers_(form, team, wants) {
    if (!wants.length) return [];
    var waiting = TransfersRepository.readTransfers(form).filter(function (t) {
      return t.status === 'pending' && t.toId === team.id;
    });
    return wants
      .filter(function (w) {
        return !waiting.some(function (t) {
          return t.code === w.code;
        });
      })
      .map(function (w) {
        return TransfersRepository.saveTransfer(form, {
          id: Crypto.uuid(),
          created: Time.nowIso(),
          status: 'pending',
          code: w.code,
          member: w.member,
          fromId: w.fromId,
          fromRef: w.fromRef,
          toId: team.id,
          toRef: team.ref,
          decidedBy: ''
        });
      });
  }

  /**
   * Closes the waiting requests of a team that no longer exists.
   *
   * @param {!Object} form The form.
   * @param {string} teamId The id of the team.
   */
  function closeTransfersOf_(form, teamId) {
    TransfersRepository.readTransfers(form).forEach(function (t) {
      var mine = t.toId === teamId || t.fromId === teamId;
      if (t.status === 'pending' && mine) {
        t.status = 'closed';
        TransfersRepository.saveTransfer(form, t);
      }
    });
  }

  /**
   * Cancels a waiting request of the team that made it.
   *
   * @param {!Object} form The form.
   * @param {*} id The id of the request.
   * @param {string} teamId The id of the team that asks to cancel.
   * @throws {ApiError} `transfer_gone` when the request is not waiting.
   */
  function cancelTransfer_(form, id, teamId) {
    var t = TransfersRepository.readTransfers(form).filter(function (x) {
      return x.id === String(id) && x.status === 'pending' && x.toId === teamId;
    })[0];
    if (!t)
      ApiError.fail('transfer_gone', 'This request was already answered.');
    t.status = 'cancelled';
    TransfersRepository.saveTransfer(form, t);
  }

  /**
   * Reads a team again after a request was answered.
   *
   * @param {!Object} form The form.
   * @param {string} teamId The id of the team.
   * @return {!Object|undefined} The team, if it still exists.
   */
  function findTeam_(form, teamId) {
    return ResponsesRepository.readResponses(form).filter(function (r) {
      return r.id === teamId;
    })[0];
  }

  return {
    findTeam: findTeam_,
    takeOutTransfers: takeOutTransfers_,
    recordTransfers: recordTransfers_,
    closeTransfersOf: closeTransfersOf_,
    cancelTransfer: cancelTransfer_
  };
})();
