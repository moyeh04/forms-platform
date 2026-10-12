/**
 * Data for the Excel export script (scripts/download_tasks.py).
 * Returns every team with its members and its project or task link, so the
 * script can download each file and build the same merged layout offline.
 */

var API = API || {};

API['admin.export.teams'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (!isTeamForm_(form)) fail('wrong_type', 'Only team and task forms can be exported as a team list.');
  var teams = teamBlocks_(form).map(function (t) {
    return {
      ref: t.ref, title: t.title, link: t.link, created: t.created,
      members: t.members.map(function (m) { return { name: m.name, code: m.code, leader: m.leader }; })
    };
  });
  var formMetadata = { slug: form.slug, title: form.title, type: form.type };
  Object.assign(formMetadata, FormMetadata.public(form));
  return { form: formMetadata, teams: teams };
});

API['admin.export.tasks'] = API['admin.export.teams'];
