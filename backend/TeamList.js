/**
 * The teams of a team or task form, numbered, each with its members (leader first). The sheet
 * view, the printed list, the dashboard, the instructor page and the download all read the
 * numbers from here, so they always agree.
 *
 * A team keeps its number for good: it is stored in the `number` column of its row, also after
 * the team is cancelled, so the teams after it do not move up. Teams registered before the
 * column existed get the numbers they had, in the order they registered.
 */

function isTeamForm_(form) {
  return form.type === 'team_registration' || form.type === 'task_submission';
}

/** Gives each live row without a number the next one, in the order they registered. Returns the rows it numbered. */
function numberTeams_(rows) {
  var top = 0;
  rows.forEach(function (r) {
    top = Math.max(top, r.number || 0);
  });
  return rows
    .filter(function (r) {
      return !r.deleted && !r.number;
    })
    .sort(byCreated_)
    .map(function (r) {
      r.number = ++top;
      return r;
    });
}

/** The responses of a form with their team numbers, whether or not the numbers are stored yet. */
function numberedResponses_(form, includeDeleted) {
  var rows = readResponses(form, true);
  if (isTeamForm_(form)) numberTeams_(rows);
  return includeDeleted
    ? rows
    : rows.filter(function (r) {
        return !r.deleted;
      });
}

/**
 * Numbers the rows that have none and stores the numbers of those already in the sheet, in one
 * write of the column. Call it inside withLock_ before a team is added or cancelled.
 */
function keepTeamNumbers_(form, rows) {
  if (!isTeamForm_(form)) return;
  var stored = numberTeams_(rows).filter(function (r) {
    return r._row;
  });
  if (!stored.length) return;
  var sh = responsesSheet(form);
  ensureHeaders_(sh, RESPONSE_COLS);
  var column = sh.getRange(
    2,
    RESPONSE_COLS.indexOf('number') + 1,
    sh.getLastRow() - 1,
    1
  );
  var values = column.getValues();
  stored.forEach(function (r) {
    values[r._row - 2][0] = String(r.number);
  });
  column.setNumberFormat('@').setValues(values);
}

function byTeamNumber_(a, b) {
  return a.number - b.number;
}

function teamBlocks_(form) {
  var vform = validationForm(form);
  return numberedResponses_(form)
    .sort(byTeamNumber_)
    .map(function (r) {
      return {
        number: r.number,
        ref: r.ref,
        title: r.title,
        link: r.link,
        created: r.created,
        response: r,
        members: Rules.membersOf(vform, r.data)
      };
    });
}

/** "Task" or "Project": what the fourth column of a team list holds. */
function teamThing_(form) {
  return form.type === 'task_submission' ? 'Task' : 'Project';
}
