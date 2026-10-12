/**
 * The teams of a team or task form, in the order they registered and numbered from one, each
 * with its members (leader first). The sheet view, the printed list, the export for the Excel
 * script and the download all read this, so they always agree on the order and the numbers.
 */

function isTeamForm_(form) {
  return form.type === 'team_registration' || form.type === 'task_submission';
}

function teamBlocks_(form) {
  var vform = validationForm(form);
  return readResponses(form).sort(byCreated_).map(function (r, i) {
    return {
      number: i + 1, ref: r.ref, title: r.title, link: r.link, created: r.created, response: r,
      members: Rules.membersOf(vform, r.data)
    };
  });
}

/** "Task" or "Project": what the fourth column of a team list holds. */
function teamThing_(form) {
  return form.type === 'task_submission' ? 'Task' : 'Project';
}
