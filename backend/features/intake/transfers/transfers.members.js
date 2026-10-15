/**
 * The members of a team as a transfer moves them: the code that names a
 * member, the team size answer, and the hand-over of the lead when the
 * leader is the one who moves.
 */

var TransferMembers = (function () {
  /**
   * Finds the id of the member question that holds a member's code.
   *
   * @param {!Object} form The form.
   * @return {string} The id, or `code` when the form names none.
   */
  function codeId(form) {
    var mf = Rules.fieldByRole(form, 'members');
    var sub = (mf?.fields || []).filter(function (sf) {
      return sf.role === 'code';
    })[0];
    return sub ? sub.id : 'code';
  }

  /**
   * Reads the members of a team, never anything but a list.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team.
   * @return {!Array<!Object>} The members, without the leader.
   */
  function listOf(form, data) {
    var list = data[Rules.fieldByRole(form, 'members').id];
    return Array.isArray(list) ? list : [];
  }

  /**
   * Makes the team size answer follow the members, so the two never
   * disagree.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team, changed in place.
   */
  function setTeamSize(form, data) {
    var mf = Rules.fieldByRole(form, 'members');
    var sf = Rules.fieldByRole(form, 'team_size');
    if (mf && sf && data[sf.id] != null) {
      data[sf.id] = String((data[mf.id] || []).length + 1);
    }
  }

  /**
   * Finds the member who leads the team next.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} list The members of the team.
   * @param {*} code The code of the next leader.
   * @return {!Object} The member.
   * @throws {ApiError} `transfer_leader` when the leader is alone, and
   *     `transfer_heir` when no member has that code.
   */
  function requireHeir_(form, list, code) {
    if (!list.length) {
      ApiError.fail(
        'transfer_leader',
        'This student leads a team alone and cannot be moved.'
      );
    }
    var id = codeId(form);
    var heir = list.filter(function (m) {
      return String(m[id]) === String(code || '');
    })[0];
    if (!heir) {
      ApiError.fail(
        'transfer_heir',
        'Choose who leads the team after this student.'
      );
    }
    return heir;
  }

  /**
   * Writes the email of the next leader, which members are not asked for.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team, changed in place.
   * @param {*} value The email.
   * @throws {ApiError} `transfer_email` when the email is not valid.
   */
  function setLeaderEmail_(form, data, value) {
    var emailField = Rules.fieldByRole(form, 'email');
    if (!emailField || emailField.enabled === false) return;
    var email = Rules.validateField(emailField, value, { form: form });
    if (!email.ok) {
      ApiError.fail('transfer_email', 'Write the email of the new leader.', {
        error: email.error
      });
    }
    data[emailField.id] = email.value;
  }

  /**
   * Copies the answers of the next leader to the leader's questions of the
   * same role or id.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team, changed in place.
   * @param {!Object} heir The answers of the next leader as a member.
   */
  function copyHeirAnswers_(form, data, heir) {
    var mf = Rules.fieldByRole(form, 'members');
    (mf.fields || []).forEach(function (sf) {
      var top = (form.fields || []).filter(function (f) {
        var same = sf.role ? f.role === sf.role : f.id === sf.id;
        return f.type === sf.type && same;
      })[0];
      if (top && heir[sf.id] != null && heir[sf.id] !== '') {
        data[top.id] = heir[sf.id];
      }
    });
  }

  /**
   * Hands the lead of a team over: the leader leaves and the member with
   * the code `next.leader` leads instead. That member's answers go to the
   * leader's questions, and `next.email` to the email question. What only
   * a leader answers, like the major, stays.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers of the team, changed in place.
   * @param {?{leader: *, email: *}} next Who leads next, and their email.
   */
  function handOver(form, data, next) {
    var who = next || {};
    var list = listOf(form, data);
    var heir = requireHeir_(form, list, who.leader);
    setLeaderEmail_(form, data, who.email);
    copyHeirAnswers_(form, data, heir);
    data[Rules.fieldByRole(form, 'members').id] = list.filter(function (m) {
      return m !== heir;
    });
  }

  return { codeId, listOf, setTeamSize, handOver };
})();
