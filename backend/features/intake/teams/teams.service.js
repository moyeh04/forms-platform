/** Which forms gather teams, and the teams as blocks of members. */

function isTeamForm_(form) {
  return form.type === 'team_registration' || form.type === 'task_submission';
}

function teamBlocks_(form) {
  var vform = FormsPublic.validationForm(form);
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
