/**
 * Starting points for the four form types and the shared lists.
 * Everything here is data: the engine never hard-codes a question.
 */

var TemplatesService = (function () {
  /** How many days an edit key works. */
  var EDIT_KEY_DAYS_ = 7;

  /** The largest team of a new team registration. */
  var TEAM_MAX_ = 6;

  /** The largest team of a new task submission. */
  var TASK_TEAM_MAX_ = 5;

  /** The title of each step a template can have. */
  var STEP_TITLES_ = {
    you: { en: 'About you', ar: 'عنك' },
    study: { en: 'Study details', ar: 'بيانات الدراسة' },
    members: { en: 'Team members', ar: 'أعضاء الفريق' },
    project: { en: 'Project', ar: 'المشروع' },
    task: { en: 'Task', ar: 'التاسك' },
    slot: { en: 'Time slot', ar: 'الميعاد' },
    schedule: { en: 'Schedule', ar: 'الجدول' }
  };

  /**
   * Makes the settings every form type shares.
   *
   * @param {string} icon The icon of the form.
   * @param {string} uniqueBy The field no two submissions may share.
   * @return {!Object} The settings, without fields or steps.
   */
  function commonConfig_(icon, uniqueBy) {
    return {
      lang: { default: 'en', allowSwitch: true },
      icon: icon,
      rules: {
        uniqueBy: uniqueBy,
        uniqueAcrossForm: false,
        driveCheck: 'strict',
        maxSubmissions: null
      },
      editKey: {
        enabled: true,
        days: EDIT_KEY_DAYS_,
        allowEdit: true,
        allowDelete: true
      },
      notifications: { confirmEmail: true, alertEmail: '' },
      review: { sequential: true, steps: [] },
      messages: {
        closed: { en: 'This form is closed.', ar: 'الفورم ده مقفول.' },
        notYet: {
          en: 'This form has not opened yet.',
          ar: 'الفورم لسه مفتحش.'
        },
        draft: {
          en: 'This form is not available yet.',
          ar: 'الفورم ده لسه مش متاح.'
        }
      }
    };
  }

  /**
   * Makes a step of a form.
   *
   * @param {string} id The id of the step, a key of STEP_TITLES_.
   * @param {!Array<string>} ids The ids of its fields.
   * @return {!Object} The step.
   */
  function step_(id, ids) {
    return { id: id, title: STEP_TITLES_[id], fields: ids };
  }

  /**
   * Makes the steps of a team or task form.
   *
   * @param {string} last The id of the last step, `project` or `task`.
   * @return {!Array<!Object>} The steps.
   */
  function teamSteps_(last) {
    return [
      step_('you', ['email', 'leader_name', 'leader_code', 'phone']),
      step_('study', ['major', 'level', 'section', 'curriculum']),
      step_('members', ['team_size', 'members']),
      step_(last, ['title', 'link'])
    ];
  }

  /**
   * Makes the fields of a team or task form: the leader, the study, the
   * team, and then the given fields.
   *
   * @param {!Array<!Object>} last The fields of the last step.
   * @return {!Array<!Object>} The fields.
   */
  function teamFields_(last) {
    return TemplateFields.personFields().concat(
      TemplateFields.studyFields(),
      [TemplateFields.teamSizeField(), TemplateFields.membersField()],
      last
    );
  }

  /**
   * Makes a team registration form.
   *
   * @return {!Object} The form settings.
   */
  function teamTemplate_() {
    var cfg = commonConfig_('team', 'leader_code');
    cfg.rules.uniqueAcrossForm = true;
    cfg.rules.teamSize = { min: 1, max: TEAM_MAX_ };
    cfg.rules.folderName = { enabled: true, subject: '' };
    cfg.fields = teamFields_([
      TemplateFields.field(
        'title',
        'english_text',
        { en: 'Project title', ar: 'اسم المشروع (بالإنجليزي)' },
        { role: 'title', help: { en: 'In English', ar: 'بالإنجليزي' } }
      ),
      TemplateFields.field(
        'link',
        'drive_link',
        { en: 'Project Drive folder link', ar: 'لينك فولدر المشروع على Drive' },
        { role: 'link', required: false, kinds: ['folder'] }
      )
    ]);
    cfg.steps = teamSteps_('project');
    return cfg;
  }

  /**
   * Makes a task submission form.
   *
   * @return {!Object} The form settings.
   */
  function taskTemplate_() {
    var cfg = commonConfig_('task', 'leader_code');
    cfg.rules.teamSize = { min: 1, max: TASK_TEAM_MAX_ };
    cfg.fields = teamFields_([
      TemplateFields.field(
        'title',
        'english_text',
        { en: 'Task name', ar: 'اسم التاسك (بالإنجليزي)' },
        { role: 'title', help: { en: 'In English', ar: 'بالإنجليزي' } }
      ),
      TemplateFields.field(
        'link',
        'drive_link',
        { en: 'Task slides link', ar: 'لينك التاسك (Drive أو Google Slides)' },
        {
          role: 'link',
          kinds: ['file', 'slides'],
          help: {
            en:
              'Share it as "Anyone with the link". ' +
              'The first slide has your name and section.',
            ar:
              'اعمله شير "Anyone with the link". ' +
              'أول سلايد فيها الاسم والسكشن.'
          }
        }
      )
    ]);
    cfg.steps = teamSteps_('task');
    return cfg;
  }

  /**
   * Makes a reservation form.
   *
   * @return {!Object} The form settings.
   */
  function reservationTemplate_() {
    var cfg = commonConfig_('calendar', 'leader_code');
    cfg.fields = TemplateFields.personFields().concat(
      TemplateFields.studyFields(),
      [
        TemplateFields.field(
          'title',
          'english_text',
          { en: 'Project title', ar: 'اسم المشروع (بالإنجليزي)' },
          { role: 'title' }
        ),
        TemplateFields.reservationMembersField(),
        TemplateFields.field(
          'slot',
          'slot',
          { en: 'Booking slot', ar: 'ميعاد المناقشة' },
          { role: 'slot' }
        )
      ]
    );
    cfg.slots = { days: [], capacity: 1 };
    cfg.editKey.allowEdit = false;
    cfg.steps = [
      step_('you', ['email', 'leader_name', 'leader_code', 'phone']),
      step_('study', ['major', 'level', 'section', 'curriculum']),
      step_('project', ['title', 'members']),
      step_('slot', ['slot'])
    ];
    return cfg;
  }

  /**
   * Makes the fields about the student of a WhatsApp registration.
   *
   * @return {!Array<!Object>} Email, name, phone and code.
   */
  function whatsappPersonFields_() {
    return [
      TemplateFields.field(
        'email',
        'email',
        { en: 'Email', ar: 'البريد الإلكتروني' },
        { role: 'email' }
      ),
      TemplateFields.field(
        'name',
        'arabic_name',
        { en: 'Full name', ar: 'الاسم رباعي' },
        {
          role: 'name',
          minParts: TemplateFields.NAME_PARTS,
          help: TemplateFields.nameHelp()
        }
      ),
      TemplateFields.field(
        'phone',
        'phone',
        { en: 'Phone number', ar: 'رقم التليفون' },
        { role: 'phone' }
      ),
      TemplateFields.field(
        'code',
        'code',
        { en: 'Code in your timetable', ar: 'الكود اللي في الجدول' },
        { role: 'code', length: TemplateFields.CODE_LENGTH }
      )
    ];
  }

  /**
   * Makes the fields about the study and timetable of a WhatsApp
   * registration.
   *
   * @return {!Array<!Object>} Level, major, group, section and timetable.
   */
  function whatsappStudyFields_() {
    return [
      TemplateFields.field(
        'level',
        'select',
        { en: 'Level / year', ar: 'المستوى / الفرقة' },
        { list: 'levels' }
      ),
      TemplateFields.field(
        'major',
        'select',
        { en: 'Major', ar: 'التخصص' },
        { list: 'majors' }
      ),
      TemplateFields.field(
        'group',
        'select',
        { en: 'Group', ar: 'الجروب' },
        {
          list: 'groups',
          help: {
            en: 'Pick A if your timetable includes Chemistry, B if it does not',
            ar: 'اختار A لو الجدول فيه كيمياء، و B لو مفيهوش'
          }
        }
      ),
      TemplateFields.field(
        'section',
        'select',
        { en: 'Section number', ar: 'رقم السكشن' },
        {
          list: 'wa_sections',
          help: {
            en:
              'The number next to TH in your timetable, ' +
              'for example 21 in 1B-TH21',
            ar: 'الرقم اللي جنب TH في جدولك'
          }
        }
      ),
      TemplateFields.field(
        'schedule',
        'drive_link',
        { en: 'Screenshot of your timetable', ar: 'صورة الجدول بتاعك' },
        {
          role: 'link',
          kinds: ['file'],
          help: {
            en: 'A Google Drive link showing your full name and code',
            ar: 'لينك Drive ظاهر فيه الاسم والكود'
          }
        }
      )
    ];
  }

  /**
   * Makes a WhatsApp registration form, with its review steps and matching.
   *
   * @return {!Object} The form settings.
   */
  function whatsappTemplate_() {
    var cfg = commonConfig_('chat', 'code');
    cfg.fields = whatsappPersonFields_().concat(whatsappStudyFields_());
    cfg.steps = [
      step_('you', ['email', 'name', 'phone', 'code']),
      step_('study', ['level', 'major', 'group', 'section']),
      step_('schedule', ['schedule'])
    ];
    cfg.review = {
      sequential: true,
      steps: [
        {
          id: 'schedule',
          label: { en: 'Timetable check', ar: 'مراجعة الجدول' }
        },
        { id: 'group', label: { en: 'Group match', ar: 'مطابقة الجروب' } }
      ]
    };
    cfg.matching = { enabled: true, field: 'phone' };
    return cfg;
  }

  /**
   * The builder of each form type, in an object with no prototype so a type
   * such as `constructor` finds nothing.
   */
  var TEMPLATES_ = Object.assign(Object.create(null), {
    team_registration: teamTemplate_,
    task_submission: taskTemplate_,
    reservation: reservationTemplate_,
    whatsapp_registration: whatsappTemplate_
  });

  /**
   * Makes the starting settings of a new form.
   *
   * @param {string} type The form type.
   * @return {!Object} The form settings.
   * @throws {ApiError} `unknown_type` for a type with no template.
   */
  function templateFor(type) {
    if (!TEMPLATES_[type])
      ApiError.fail('unknown_type', 'Unknown form type: ' + type);
    return TEMPLATES_[type]();
  }

  return { templateFor };
})();
