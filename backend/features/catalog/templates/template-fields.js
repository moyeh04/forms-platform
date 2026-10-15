/**
 * The fields every form template is built from: people, study, team size and
 * members.
 */

function field_(id, type, en, ar, extra) {
  return Object.assign(
    { id: id, type: type, label: { en: en, ar: ar }, required: true },
    extra || {}
  );
}

function personFields_() {
  return [
    field_('email', 'email', 'Email', 'البريد الإلكتروني', { role: 'email' }),
    field_(
      'leader_name',
      'arabic_name',
      'Team leader name',
      'اسم قائد الفريق',
      {
        role: 'name',
        minParts: 4,
        help: {
          en: 'Four-part name, in Arabic letters only',
          ar: 'الاسم رباعي وبالعربي فقط'
        }
      }
    ),
    field_('leader_code', 'code', 'Team leader code', 'كود قائد الفريق', {
      role: 'code',
      length: 7
    }),
    field_('phone', 'phone', 'Team leader phone', 'رقم تليفون قائد الفريق', {
      role: 'phone'
    })
  ];
}

function studyFields_() {
  return [
    field_('major', 'select', 'Major', 'التخصص', { list: 'majors' }),
    field_('level', 'select', 'Level / year', 'المستوى / الفرقة', {
      list: 'levels'
    }),
    field_('section', 'select', 'Section', 'السكشن', { list: 'sections' }),
    field_('curriculum', 'select', 'Bylaw', 'اللائحة', { list: 'curricula' })
  ];
}

function teamSizeField_() {
  return field_('team_size', 'team_size', 'Team size', 'عدد أعضاء الفريق', {
    role: 'team_size',
    help: {
      en: 'How many people are in the team, including you',
      ar: 'كام فرد في الفريق، شاملًا حضرتك'
    }
  });
}

function membersField_() {
  return field_('members', 'members', 'Team members', 'أعضاء الفريق', {
    role: 'members',
    fields: [
      field_('name', 'arabic_name', 'Full name', 'الاسم رباعي', {
        role: 'name',
        minParts: 4
      }),
      field_('phone', 'phone', 'Phone', 'رقم التليفون', { role: 'phone' }),
      field_('code', 'code', 'Code', 'الكود', { role: 'code', length: 7 }),
      field_('level', 'select', 'Level / year', 'المستوى / الفرقة', {
        list: 'levels'
      }),
      field_('curriculum', 'select', 'Bylaw', 'اللائحة', { list: 'curricula' }),
      field_('section', 'select', 'Section', 'السكشن', { list: 'sections' })
    ]
  });
}

function reservationMembersField_() {
  var members = membersField_();
  members.enabled = false;
  members.required = true;
  members.min = 1;
  members.max = 5;
  members.label = { en: 'Teammates', ar: 'أعضاء الفريق' };
  members.help = {
    en: 'Add the other people on your team.',
    ar: 'أضف باقي أعضاء فريقك.'
  };
  return members;
}

function normalizeReservationMembers_(form) {
  if (form.type !== 'reservation') return form;
  form.fields = form.fields || [];
  form.steps = form.steps || [];
  var members = Rules.fieldByRole(form, 'members');
  if (!members) {
    members = reservationMembersField_();
    form.fields.push(members);
  }
  // The number of teammates stays a range that the page can draw: 0 to 19, with room for at least one.
  var min = parseInt(members.min, 10),
    max = parseInt(members.max, 10);
  members.min = Math.max(0, Math.min(19, isNaN(min) ? 1 : min));
  members.max = Math.max(1, members.min, Math.min(19, isNaN(max) ? 5 : max));
  // The note for some numbers of teammates is cleaned like the team size note, and dropped when no number has it.
  var notice = members.notice
    ? FormsRules.normalizeSizeNotice(members.notice, members.min, members.max)
    : null;
  if (notice && notice.sizes.length) members.notice = notice;
  else delete members.notice;
  var project = form.steps.filter(function (step) {
    return step.id === 'project';
  })[0];
  if (project && project.fields.indexOf(members.id) === -1)
    project.fields.push(members.id);
  return form;
}
