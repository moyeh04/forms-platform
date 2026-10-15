/**
 * What the leaders and the admin see of the transfer requests: the
 * requests of a team, the waiting ones on the dashboard, who can lead a
 * team next, and the phone of the other leader while a request waits.
 */

var TransfersView = (function () {
  /**
   * Makes a function from a team id to what a leader may see of that
   * team's leader while a request waits: `{phone}`, with `whatsapp: true`
   * when the form opens the number in WhatsApp. Nothing unless the form
   * shows the phones. The teams are read once, on the first call.
   *
   * @param {!Object} form The form.
   * @return {function(string): !Object} The contact of a team's leader.
   */
  function leaderContacts(form) {
    var rules = form.rules || {};
    var rows = null;
    return function (teamId) {
      if (rules.transferPhones !== true) return {};
      rows = rows || ResponsesRepository.readResponses(form);
      var team = rows.filter(function (r) {
        return r.id === teamId;
      })[0];
      var phone = team
        ? String(Rules.valueByRole(form, team.data, 'phone') || '')
        : '';
      if (!phone) return {};
      return rules.transferWhatsapp === true
        ? { phone: phone, whatsapp: true }
        : { phone: phone };
    };
  }

  /**
   * Says, for a request that asks for the leader of a team, the members
   * who can lead it next.
   *
   * @param {!Object} form The form.
   * @param {?Object} team The team that holds the member.
   * @param {*} code The code of the member asked for.
   * @return {!Object} `{leader: true, heirs}` when the leader is asked
   *     for; empty when a member is.
   */
  function leaderAsked(form, team, code) {
    var people = team ? Rules.membersOf(form, team.data) : [];
    var isLeader = people.some(function (m) {
      return m.leader && String(m.code) === String(code);
    });
    if (!isLeader) return {};
    return {
      leader: true,
      heirs: people
        .filter(function (m) {
          return !m.leader && m.code;
        })
        .map(function (m) {
          return { code: String(m.code), name: m.name };
        })
    };
  }

  /**
   * Lists the waiting requests for the members of a team.
   *
   * @param {!Object} form The form.
   * @param {!Object} team The team.
   * @param {!Array<!Object>} all Every request.
   * @param {function(string): !Object} contact The contacts of
   *     `leaderContacts`.
   * @return {!Array<!Object>} What the leader sees of each.
   */
  function incoming_(form, team, all, contact) {
    var range = Rules.teamSizeRange(form);
    var people = Rules.membersOf(form, team.data);
    return all
      .filter(function (t) {
        return t.status === 'pending' && t.fromId === team.id;
      })
      .map(function (t) {
        var m =
          people.filter(function (x) {
            return String(x.code) === t.code;
          })[0] || {};
        return Object.assign(
          {
            id: t.id,
            code: t.code,
            name: m.name || '',
            team: t.toRef,
            sizeAfter: Math.max(people.length - 1, 0),
            min: range.min
          },
          leaderAsked(form, team, t.code),
          contact(t.toId)
        );
      });
  }

  /**
   * Lists the requests a team made, but the cancelled ones.
   *
   * @param {!Object} team The team.
   * @param {!Array<!Object>} all Every request.
   * @param {function(string): !Object} contact The contacts of
   *     `leaderContacts`.
   * @return {!Array<!Object>} What the leader sees of each.
   */
  function outgoing_(team, all, contact) {
    return all
      .filter(function (t) {
        return t.toId === team.id && t.status !== 'cancelled';
      })
      .map(function (t) {
        return Object.assign(
          {
            id: t.id,
            code: t.code,
            name: t.member.name || '',
            team: t.fromRef,
            status: t.status
          },
          t.status === 'pending' ? contact(t.fromId) : {}
        );
      });
  }

  /**
   * Shows a team the requests for its members and its own requests.
   *
   * @param {!Object} form The form.
   * @param {!Object} team The team.
   * @return {{incoming: !Array<!Object>, outgoing: !Array<!Object>}} The
   *     requests.
   */
  function teamTransfers(form, team) {
    var all = TransfersRepository.readTransfers(form);
    if (!all.length) return { incoming: [], outgoing: [] };
    var contact = leaderContacts(form);
    return {
      incoming: incoming_(form, team, all, contact),
      outgoing: outgoing_(team, all, contact)
    };
  }

  /**
   * Lists the waiting requests with the names the dashboard shows and, for
   * a leader, who can lead next.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} The requests.
   */
  function adminTransfers(form) {
    var waiting = TransfersRepository.readTransfers(form).filter(function (t) {
      return t.status === 'pending';
    });
    var rows = waiting.length ? ResponsesRepository.readResponses(form) : [];
    return waiting.map(function (t) {
      var from = rows.filter(function (r) {
        return r.id === t.fromId;
      })[0];
      return Object.assign(
        {
          id: t.id,
          created: t.created,
          code: t.code,
          name: t.member.name || '',
          from: t.fromRef,
          to: t.toRef
        },
        leaderAsked(form, from, t.code)
      );
    });
  }

  return { leaderContacts, leaderAsked, teamTransfers, adminTransfers };
})();
