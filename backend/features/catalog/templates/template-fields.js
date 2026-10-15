/**
 * The fields every form template is built from: people, study, team size and
 * members.
 */

var TemplateFields = (function () {
  /** How many digits a student code has. */
  var CODE_LENGTH = 7;

  /** How many parts a full Arabic name has. */
  var NAME_PARTS = 4;

  /** The most teammates the page can draw. */
  var MAX_TEAMMATES_ = 19;

  /** The most teammates a new reservation form allows. */
  var DEFAULT_MAX_TEAMMATES_ = 5;

  /**
   * Makes the help text of a full Arabic name, a fresh copy each time so a
   * form that edits it changes no other form.
   *
   * @return {{en: string, ar: string}} The help text.
   */
  function nameHelp_() {
    return {
      en: 'Four-part name, in Arabic letters only',
      ar: 'الاسم رباعي وبالعربي فقط'
    };
  }

  /**
   * Makes a required field.
   *
   * @param {string} id The id of the field.
   * @param {string} type Its type, such as `email` or `select`.
   * @param {{en: string, ar: string}} label Its label in each language.
   * @param {!Object=} extra More settings, such as `role` or `list`.
   * @return {!Object} The field.
   */
  function field_(id, type, label, extra) {
    return Object.assign(
      { id: id, type: type, label: label, required: true },
      extra || {}
    );
  }

  /**
   * Makes the fields about the team leader.
   *
   * @return {!Array<!Object>} Email, name, code and phone.
   */
  function personFields_() {
    return [
      field_(
        'email',
        'email',
        { en: 'Email', ar: 'البريد الإلكتروني' },
        { role: 'email' }
      ),
      field_(
        'leader_name',
        'arabic_name',
        { en: 'Team leader name', ar: 'اسم قائد الفريق' },
        { role: 'name', minParts: NAME_PARTS, help: nameHelp_() }
      ),
      field_(
        'leader_code',
        'code',
        { en: 'Team leader code', ar: 'كود قائد الفريق' },
        { role: 'code', length: CODE_LENGTH }
      ),
      field_(
        'phone',
        'phone',
        { en: 'Team leader phone', ar: 'رقم تليفون قائد الفريق' },
        { role: 'phone' }
      )
    ];
  }

  /**
   * Makes the fields about what the leader studies.
   *
   * @return {!Array<!Object>} Major, level, section and bylaw.
   */
  function studyFields_() {
    return [
      field_(
        'major',
        'select',
        { en: 'Major', ar: 'التخصص' },
        { list: 'majors' }
      ),
      field_(
        'level',
        'select',
        { en: 'Level / year', ar: 'المستوى / الفرقة' },
        { list: 'levels' }
      ),
      field_(
        'section',
        'select',
        { en: 'Section', ar: 'السكشن' },
        { list: 'sections' }
      ),
      field_(
        'curriculum',
        'select',
        { en: 'Bylaw', ar: 'اللائحة' },
        { list: 'curricula' }
      )
    ];
  }

  /**
   * Makes the team size field.
   *
   * @return {!Object} The field.
   */
  function teamSizeField_() {
    return field_(
      'team_size',
      'team_size',
      { en: 'Team size', ar: 'عدد أعضاء الفريق' },
      {
        role: 'team_size',
        help: {
          en: 'How many people are in the team, including you',
          ar: 'كام فرد في الفريق، شاملًا حضرتك'
        }
      }
    );
  }

  /**
   * Makes the team members field, with the fields of one member.
   *
   * @return {!Object} The field.
   */
  function membersField_() {
    return field_(
      'members',
      'members',
      { en: 'Team members', ar: 'أعضاء الفريق' },
      {
        role: 'members',
        fields: [
          field_(
            'name',
            'arabic_name',
            { en: 'Full name', ar: 'الاسم رباعي' },
            { role: 'name', minParts: NAME_PARTS }
          ),
          field_(
            'phone',
            'phone',
            { en: 'Phone', ar: 'رقم التليفون' },
            { role: 'phone' }
          ),
          field_(
            'code',
            'code',
            { en: 'Code', ar: 'الكود' },
            { role: 'code', length: CODE_LENGTH }
          ),
          field_(
            'level',
            'select',
            { en: 'Level / year', ar: 'المستوى / الفرقة' },
            { list: 'levels' }
          ),
          field_(
            'curriculum',
            'select',
            { en: 'Bylaw', ar: 'اللائحة' },
            { list: 'curricula' }
          ),
          field_(
            'section',
            'select',
            { en: 'Section', ar: 'السكشن' },
            { list: 'sections' }
          )
        ]
      }
    );
  }

  /**
   * Makes the teammates field of a reservation form, turned off.
   *
   * @return {!Object} The field.
   */
  function reservationMembersField_() {
    var members = membersField_();
    members.enabled = false;
    members.required = true;
    members.min = 1;
    members.max = DEFAULT_MAX_TEAMMATES_;
    members.label = { en: 'Teammates', ar: 'أعضاء الفريق' };
    members.help = {
      en: 'Add the other people on your team.',
      ar: 'أضف باقي أعضاء فريقك.'
    };
    return members;
  }

  /**
   * Keeps the number of teammates a range the page can draw: 0 to
   * MAX_TEAMMATES_, with room for at least one.
   *
   * @param {!Object} members The teammates field, changed in place.
   */
  function clampTeammates_(members) {
    var min = parseInt(members.min, 10);
    var max = parseInt(members.max, 10);
    members.min = Math.max(
      0,
      Math.min(MAX_TEAMMATES_, Number.isNaN(min) ? 1 : min)
    );
    members.max = Math.max(
      1,
      members.min,
      Math.min(MAX_TEAMMATES_, Number.isNaN(max) ? DEFAULT_MAX_TEAMMATES_ : max)
    );
  }

  /**
   * Cleans the note for some numbers of teammates like the team size note,
   * and drops it when no number has it.
   *
   * @param {!Object} members The teammates field, changed in place.
   */
  function cleanTeammatesNotice_(members) {
    var notice = members.notice
      ? FormsRules.normalizeSizeNotice(members.notice, members.min, members.max)
      : null;
    if (notice?.sizes.length) members.notice = notice;
    else delete members.notice;
  }

  /**
   * Gives a reservation form a valid teammates field, adding it when it is
   * missing, and puts the field on the project step.
   *
   * @param {!Object} form The form, changed in place.
   * @return {!Object} The same form.
   */
  function normalizeReservationMembers_(form) {
    if (form.type !== FormType.RESERVATION) return form;
    form.fields = form.fields || [];
    form.steps = form.steps || [];
    var members = Rules.fieldByRole(form, 'members');
    if (!members) {
      members = reservationMembersField_();
      form.fields.push(members);
    }
    clampTeammates_(members);
    cleanTeammatesNotice_(members);
    var project = form.steps.filter(function (step) {
      return step.id === 'project';
    })[0];
    if (project && project.fields.indexOf(members.id) === -1)
      project.fields.push(members.id);
    return form;
  }

  return {
    CODE_LENGTH,
    NAME_PARTS,
    nameHelp: nameHelp_,
    normalizeReservationMembers: normalizeReservationMembers_,
    personFields: personFields_,
    studyFields: studyFields_,
    teamSizeField: teamSizeField_,
    membersField: membersField_,
    field: field_,
    reservationMembersField: reservationMembersField_
  };
})();
