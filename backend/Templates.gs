/**
 * Starting points for the four form types and the shared lists.
 * Everything here is data: the engine never hard-codes a question.
 */

var DEFAULT_LISTS = {
  levels: [
    ['صفر / الأولى', 'Level 0 / Year 1'],
    ['الأول / الثانية', 'Level 1 / Year 2'],
    ['الثاني / الثالثة', 'Level 2 / Year 3'],
    ['الثالث / الرابعة', 'Level 3 / Year 4'],
    ['الرابع / الخامسة', 'Level 4 / Year 5']
  ],
  curricula: ['2020', '2018', '2012'],
  majors: [['حاسبات', 'Computers'], ['اتصالات', 'Communications']],
  sections: ['4C-TH1', '4C-TH2', '4C-TH3', '4C-TH4', '4C-TH5', '4C-TH6', '4C-TH7', '4C-TH8', '4C-T1', '4C-T2', '4C-T3', '4C-O1', '4C-O2', '4C-O3'],
  groups: ['A', 'B'],
  wa_sections: (function () { var a = []; for (var i = 1; i <= 33; i++) a.push(String(i)); return a; })()
};

/** Turns ['ar', 'en'] pairs or plain strings into option objects. */
function normalizeListValues(values) {
  return (values || []).map(function (v) {
    if (Array.isArray(v)) return { value: v[0], label: { ar: v[0], en: v[1] || v[0] } };
    if (v && typeof v === 'object') return { value: String(v.value), label: v.label || { en: String(v.value), ar: String(v.value) } };
    return { value: String(v), label: { en: String(v), ar: String(v) } };
  });
}

function field_(id, type, en, ar, extra) {
  return Object.assign({ id: id, type: type, label: { en: en, ar: ar }, required: true }, extra || {});
}

function personFields_() {
  return [
    field_('email', 'email', 'Email', 'البريد الإلكتروني', { role: 'email' }),
    field_('leader_name', 'arabic_name', 'Team leader name', 'اسم قائد الفريق', {
      role: 'name', minParts: 4,
      help: { en: 'Four-part name, in Arabic letters only', ar: 'الاسم رباعي وبالعربي فقط' }
    }),
    field_('leader_code', 'code', 'Team leader code', 'كود قائد الفريق', { role: 'code', length: 7 }),
    field_('phone', 'phone', 'Team leader phone', 'رقم تليفون قائد الفريق', { role: 'phone' })
  ];
}

function studyFields_() {
  return [
    field_('major', 'select', 'Major', 'التخصص', { list: 'majors' }),
    field_('level', 'select', 'Level / year', 'المستوى / الفرقة', { list: 'levels' }),
    field_('section', 'select', 'Section', 'السكشن', { list: 'sections' }),
    field_('curriculum', 'select', 'Bylaw', 'اللائحة', { list: 'curricula' })
  ];
}

function teamSizeField_() {
  return field_('team_size', 'team_size', 'Team size', 'عدد أعضاء الفريق', {
    role: 'team_size',
    help: { en: 'How many people are in the team, including you', ar: 'كام فرد في الفريق، شاملًا حضرتك' }
  });
}

function membersField_() {
  return field_('members', 'members', 'Team members', 'أعضاء الفريق', {
    role: 'members',
    fields: [
      field_('name', 'arabic_name', 'Full name', 'الاسم رباعي', { role: 'name', minParts: 4 }),
      field_('phone', 'phone', 'Phone', 'رقم التليفون', { role: 'phone' }),
      field_('code', 'code', 'Code', 'الكود', { role: 'code', length: 7 }),
      field_('level', 'select', 'Level / year', 'المستوى / الفرقة', { list: 'levels' }),
      field_('curriculum', 'select', 'Bylaw', 'اللائحة', { list: 'curricula' }),
      field_('section', 'select', 'Section', 'السكشن', { list: 'sections' })
    ]
  });
}

function commonConfig_(icon, uniqueBy) {
  return {
    lang: { default: 'en', allowSwitch: true },
    icon: icon,
    rules: { uniqueBy: uniqueBy, uniqueAcrossForm: false, driveCheck: 'strict', maxSubmissions: null },
    editKey: { enabled: true, days: 7, allowEdit: true, allowDelete: true },
    notifications: { confirmEmail: true, alertEmail: '' },
    review: { sequential: true, steps: [] },
    messages: {
      closed: { en: 'This form is closed.', ar: 'الفورم ده مقفول.' },
      notYet: { en: 'This form has not opened yet.', ar: 'الفورم لسه مفتحش.' },
      draft: { en: 'This form is not available yet.', ar: 'الفورم ده لسه مش متاح.' }
    }
  };
}

var STEP_TITLES_ = {
  you: { en: 'About you', ar: 'عنك' },
  study: { en: 'Study details', ar: 'بيانات الدراسة' },
  members: { en: 'Team members', ar: 'أعضاء الفريق' },
  project: { en: 'Project', ar: 'المشروع' },
  task: { en: 'Task', ar: 'التاسك' },
  slot: { en: 'Time slot', ar: 'الميعاد' },
  schedule: { en: 'Schedule', ar: 'الجدول' }
};

function step_(id, ids) {
  return { id: id, title: STEP_TITLES_[id], fields: ids };
}

function templateFor(type) {
  var cfg;
  if (type === 'team_registration') {
    cfg = commonConfig_('team', 'leader_code');
    cfg.rules.uniqueAcrossForm = true;
    cfg.rules.teamSize = { min: 1, max: 6 };
    cfg.fields = personFields_().concat(studyFields_(), [
      teamSizeField_(),
      membersField_(),
      field_('title', 'english_text', 'Project title', 'اسم المشروع (بالإنجليزي)', { role: 'title', help: { en: 'In English', ar: 'بالإنجليزي' } }),
      field_('link', 'drive_link', 'Project Drive folder link', 'لينك فولدر المشروع على Drive', { role: 'link', required: false, kinds: ['folder'] })
    ]);
    cfg.steps = [
      step_('you', ['email', 'leader_name', 'leader_code', 'phone']),
      step_('study', ['major', 'level', 'section', 'curriculum']),
      step_('members', ['team_size', 'members']),
      step_('project', ['title', 'link'])
    ];
  } else if (type === 'task_submission') {
    cfg = commonConfig_('task', 'leader_code');
    cfg.rules.teamSize = { min: 1, max: 5 };
    cfg.fields = personFields_().concat(studyFields_(), [
      teamSizeField_(),
      membersField_(),
      field_('title', 'english_text', 'Task name', 'اسم التاسك (بالإنجليزي)', { role: 'title', help: { en: 'In English', ar: 'بالإنجليزي' } }),
      field_('link', 'drive_link', 'Task slides link', 'لينك التاسك (Drive أو Google Slides)', {
        role: 'link', kinds: ['file', 'slides'],
        help: { en: 'Share it as "Anyone with the link". The first slide has your name and section.', ar: 'اعمله شير "Anyone with the link". أول سلايد فيها الاسم والسكشن.' }
      })
    ]);
    cfg.steps = [
      step_('you', ['email', 'leader_name', 'leader_code', 'phone']),
      step_('study', ['major', 'level', 'section', 'curriculum']),
      step_('members', ['team_size', 'members']),
      step_('task', ['title', 'link'])
    ];
  } else if (type === 'reservation') {
    cfg = commonConfig_('calendar', 'leader_code');
    cfg.fields = personFields_().concat(studyFields_(), [
      field_('title', 'english_text', 'Project title', 'اسم المشروع (بالإنجليزي)', { role: 'title' }),
      field_('slot', 'slot', 'Booking slot', 'ميعاد المناقشة', { role: 'slot' })
    ]);
    cfg.slots = { days: [], capacity: 1 };
    cfg.editKey.allowEdit = false;
    cfg.steps = [
      step_('you', ['email', 'leader_name', 'leader_code', 'phone']),
      step_('study', ['major', 'level', 'section', 'curriculum']),
      step_('project', ['title']),
      step_('slot', ['slot'])
    ];
  } else if (type === 'whatsapp_registration') {
    cfg = commonConfig_('chat', 'code');
    cfg.fields = [
      field_('email', 'email', 'Email', 'البريد الإلكتروني', { role: 'email' }),
      field_('name', 'arabic_name', 'Full name', 'الاسم رباعي', { role: 'name', minParts: 4, help: { en: 'Four-part name, in Arabic letters only', ar: 'الاسم رباعي وبالعربي فقط' } }),
      field_('phone', 'phone', 'Phone number', 'رقم التليفون', { role: 'phone' }),
      field_('code', 'code', 'Code in your timetable', 'الكود اللي في الجدول', { role: 'code', length: 7 }),
      field_('level', 'select', 'Level / year', 'المستوى / الفرقة', { list: 'levels' }),
      field_('major', 'select', 'Major', 'التخصص', { list: 'majors' }),
      field_('group', 'select', 'Group', 'الجروب', {
        list: 'groups',
        help: { en: 'Pick A if your timetable includes Chemistry, B if it does not', ar: 'اختار A لو الجدول فيه كيمياء، و B لو مفيهوش' }
      }),
      field_('section', 'select', 'Section number', 'رقم السكشن', {
        list: 'wa_sections',
        help: { en: 'The number next to TH in your timetable, for example 21 in 1B-TH21', ar: 'الرقم اللي جنب TH في جدولك' }
      }),
      field_('schedule', 'drive_link', 'Screenshot of your timetable', 'صورة الجدول بتاعك', {
        role: 'link', kinds: ['file'],
        help: { en: 'A Google Drive link showing your full name and code', ar: 'لينك Drive ظاهر فيه الاسم والكود' }
      })
    ];
    cfg.steps = [
      step_('you', ['email', 'name', 'phone', 'code']),
      step_('study', ['level', 'major', 'group', 'section']),
      step_('schedule', ['schedule'])
    ];
    cfg.review = {
      sequential: true,
      steps: [
        { id: 'schedule', label: { en: 'Timetable check', ar: 'مراجعة الجدول' } },
        { id: 'group', label: { en: 'Group match', ar: 'مطابقة الجروب' } }
      ]
    };
    cfg.matching = { enabled: true, field: 'phone' };
  } else {
    fail('unknown_type', 'Unknown form type: ' + type);
  }
  return cfg;
}
