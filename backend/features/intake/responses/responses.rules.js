/**
 * Whether a form takes submissions, and the limits on how many and how big.
 */

var ResponsesRules = (function () {
  /**
   * Refuses a form that does not take submissions now.
   *
   * @param {!Object} form The form.
   * @throws {ApiError} `form_<state>` when the form is not open.
   */
  function assertAcceptingSubmissions_(form) {
    var state = Rules.formState(form);
    if (state !== 'open')
      ApiError.fail(
        'form_' + state,
        'This form is not accepting submissions.',
        {
          state: state
        }
      );
  }

  /**
   * Refuses a new submission to a full form.
   *
   * @param {!Object} rules The rules of the form.
   * @param {!Array<!Object>} others The other submissions.
   * @param {string=} selfId The id of the submission being edited.
   * @throws {ApiError} `form_full`.
   */
  function checkFull_(rules, others, selfId) {
    if (
      rules.maxSubmissions &&
      !selfId &&
      others.length >= rules.maxSubmissions
    )
      ApiError.fail('form_full', 'This form is full.');
  }

  /**
   * Refuses a value of the unique field another submission has.
   *
   * @param {!Object} rules The rules of the form.
   * @param {!Object} data The answers.
   * @param {!Array<!Object>} others The other submissions.
   * @throws {ApiError} `duplicate`.
   */
  function checkUnique_(rules, data, others) {
    var field = rules.uniqueBy;
    if (!field || !data[field]) return;
    others.forEach(function (r) {
      if (String(r.data[field]) === String(data[field]))
        ApiError.fail(
          'duplicate',
          'This code is already registered. Use your key to edit it.',
          { field: field }
        );
    });
  }

  /**
   * Refuses a team with someone who is in another team of the form.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers.
   * @param {!Array<!Object>} others The other submissions.
   * @throws {ApiError} `duplicate_member`, with the codes found twice.
   */
  function checkMembers_(form, data, others) {
    var mine = {};
    var clash = [];
    Rules.membersOf(form, data).forEach(function (m) {
      if (m.code) mine[m.code] = true;
    });
    others.forEach(function (r) {
      Rules.membersOf(form, r.data).forEach(function (m) {
        if (m.code && mine[m.code]) clash.push(m.code);
      });
    });
    if (clash.length)
      ApiError.fail(
        'duplicate_member',
        'Someone on this team is already registered in another team.',
        { codes: clash }
      );
  }

  /**
   * Refuses a slot that has no room left.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers.
   * @param {!Array<!Object>} others The other submissions.
   * @throws {ApiError} `slot_taken`.
   */
  function checkSlot_(form, data, others) {
    var slotField = Rules.fieldByRole(form, 'slot');
    if (!slotField || !data[slotField.id]) return;
    var key = Rules.slotKey(data[slotField.id].day, data[slotField.id].time);
    var counts = {};
    others.forEach(function (r) {
      if (r.slot) counts[r.slot] = (counts[r.slot] || 0) + 1;
    });
    if (!Rules.slotRoom(form, counts, key))
      ApiError.fail('slot_taken', 'That slot was just taken. Pick another.', {
        slot: key
      });
  }

  /**
   * Checks a submission against the limits of its form: how many, unique
   * values, members in one team only, and room in its slot.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers.
   * @param {!Array<!Object>} rows The saved submissions.
   * @param {string=} selfId The id of the submission being edited.
   * @throws {ApiError} When a limit is broken.
   */
  function checkLimits_(form, data, rows, selfId) {
    var others = rows.filter(function (r) {
      return r.id !== selfId;
    });
    var rules = form.rules || {};
    checkFull_(rules, others, selfId);
    checkUnique_(rules, data, others);
    if (rules.uniqueAcrossForm) checkMembers_(form, data, others);
    checkSlot_(form, data, others);
  }

  /**
   * Counts the saved responses that give each number.
   *
   * @param {!Object} form The form.
   * @param {function(!Object): number} numberOf Reads the number of one
   *     response.
   * @return {!Object<string, number>} The count of each number, such as
   *     `{ "3": 2, "5": 7 }`.
   */
  function countResponses_(form, numberOf) {
    var counts = {};
    ResponsesRepository.readResponses(form).forEach(function (r) {
      var n = numberOf(r);
      counts[n] = (counts[n] || 0) + 1;
    });
    return counts;
  }

  /**
   * Counts the saved teams of each size. A team with no size counts under 0.
   *
   * @param {!Object} form The form.
   * @return {!Object<string, number>} The count of each size.
   */
  function teamSizes_(form) {
    var field = Rules.fieldByRole(form, 'team_size');
    return countResponses_(form, function (r) {
      return parseInt(r.data[field.id], 10) || 0;
    });
  }

  /**
   * Counts the saved bookings with each number of teammates.
   *
   * @param {!Object} form The form.
   * @return {!Object<string, number>} The count of each number.
   */
  function teammateCounts_(form) {
    var field = Rules.fieldByRole(form, 'members');
    return countResponses_(form, function (r) {
      var list = r.data[field.id];
      return Array.isArray(list) ? list.length : 0;
    });
  }

  return {
    teamSizes: teamSizes_,
    teammateCounts: teammateCounts_,
    assertAcceptingSubmissions: assertAcceptingSubmissions_,
    checkLimits: checkLimits_
  };
})();
