/** Whether a form takes submissions, and the limits on how many and how big. */

var ResponsesRules = (function () {
function assertAcceptingSubmissions_(form) {
  var state = Rules.formState(form);
  if (state !== 'open')
    ApiError.fail('form_' + state, 'This form is not accepting submissions.', {
      state: state
    });
}

function checkLimits_(form, data, rows, selfId) {
  var others = rows.filter(function (r) {
    return r.id !== selfId;
  });
  var rules = form.rules || {};

  if (
    rules.maxSubmissions &&
    !selfId &&
    others.length >= rules.maxSubmissions
  ) {
    ApiError.fail('form_full', 'This form is full.');
  }

  if (rules.uniqueBy && data[rules.uniqueBy]) {
    others.forEach(function (r) {
      if (String(r.data[rules.uniqueBy]) === String(data[rules.uniqueBy])) {
        ApiError.fail(
          'duplicate',
          'This code is already registered. Use your key to edit it.',
          { field: rules.uniqueBy }
        );
      }
    });
  }

  if (rules.uniqueAcrossForm) {
    var mine = {};
    Rules.membersOf(form, data).forEach(function (m) {
      if (m.code) mine[m.code] = true;
    });
    var clash = [];
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

  var slotField = Rules.fieldByRole(form, 'slot');
  if (slotField && data[slotField.id]) {
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
}

/** How many saved responses give each number: { "3": 2, "5": 7 }. numberOf reads it from one response. */
function countResponses_(form, numberOf) {
  var counts = {};
  ResponsesRepository.readResponses(form).forEach(function (r) {
    var n = numberOf(r);
    counts[n] = (counts[n] || 0) + 1;
  });
  return counts;
}

/** How many saved teams have each size. A team with no size counts under 0. */
function teamSizes_(form) {
  var field = Rules.fieldByRole(form, 'team_size');
  return countResponses_(form, function (r) {
    return parseInt(r.data[field.id], 10) || 0;
  });
}

/** How many saved bookings have each number of teammates. */
function teammateCounts_(form) {
  var field = Rules.fieldByRole(form, 'members');
  return countResponses_(form, function (r) {
    var list = r.data[field.id];
    return Array.isArray(list) ? list.length : 0;
  });
}

return { teamSizes: teamSizes_, teammateCounts: teammateCounts_, assertAcceptingSubmissions: assertAcceptingSubmissions_, checkLimits: checkLimits_ };
})();
