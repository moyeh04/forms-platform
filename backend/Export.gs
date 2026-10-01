/**
 * Data for the Excel export script (scripts/download_tasks.py).
 * Returns every team with its members and its project or task link, so the
 * script can download each file and build the same merged layout offline.
 */

var API = API || {};

API['admin.export.teams'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (form.type !== 'team_registration' && form.type !== 'task_submission') {
    fail('wrong_type', 'Only team and task forms can be exported as a team list.');
  }
  var vform = validationForm(form);
  var teams = readResponses(form).sort(byCreated_).map(function (r) {
    return {
      ref: r.ref, title: r.title, link: r.link, created: r.created,
      members: Rules.membersOf(vform, r.data).map(function (m) { return { name: m.name, code: m.code, leader: m.leader }; })
    };
  });
  return { form: { slug: form.slug, title: form.title, term: form.term, type: form.type }, teams: teams };
});

API['admin.export.tasks'] = API['admin.export.teams'];
