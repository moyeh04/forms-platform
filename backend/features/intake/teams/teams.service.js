/** Which forms gather teams, and the teams as blocks of members. */

var TeamsService = (function () {
  /**
   * Says whether a form gathers teams.
   *
   * @param {!Object} form The form.
   * @return {boolean} True for team registrations and task submissions.
   */
  function isTeamForm_(form) {
    return (
      form.type === FormType.TEAM_REGISTRATION ||
      form.type === FormType.TASK_SUBMISSION
    );
  }

  /**
   * Lists the teams of a form in number order, each with its members.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} One block for each live team.
   */
  function teamBlocks_(form) {
    var vform = FormsPublic.validationForm(form);
    return TeamNumbers.numberedResponses(form)
      .sort(TeamNumbers.byTeamNumber)
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

  /**
   * Names what the fourth column of a team list holds.
   *
   * @param {!Object} form The form.
   * @return {string} "Task" or "Project".
   */
  function teamThing_(form) {
    return form.type === FormType.TASK_SUBMISSION ? 'Task' : 'Project';
  }

  return {
    isTeamForm: isTeamForm_,
    teamBlocks: teamBlocks_,
    teamThing: teamThing_
  };
})();
