/** English by default, Arabic on request. Form questions carry their own { en, ar } labels. */
(function (App) {
  'use strict';

  var STR = {
    en: {
      loading: 'Opening the form...',
      notFound: 'This form does not exist. Check the link and try again.',
      connError: 'Could not reach the server. Check your connection and try again.',
      retry: 'Try again',
      closed: 'This form is closed.', notYet: 'This form has not opened yet.', draft: 'This form is not available yet.',
      next: 'Next', back: 'Back', submit: 'Submit registration', book: 'Confirm booking', submitting: 'Sending...',
      stepOf: 'Step {n} of {total}', treasure: 'Treasure!', reviewStep: 'Review', reviewTitle: 'Check your details',
      reviewHelp: 'Make sure everything is right before you send it.', reviewHelpKey: 'Make sure everything is right. You can still fix it later with your key.',
      optional: 'optional', change: 'Change', choose: 'Choose...',
      onlyFor: 'For {names} students only', and: ' and ',
      folderRule: 'Name the folder Team_Leader_Name_Project_Name_Subject_Name, like {example}: no spaces, parts joined by underscores.',
      addMember: 'Add a team member', removeMember: 'Remove', memberN: 'Team member {n}', teamSize: 'Team of {n}',
      pickSize: 'Choose the team size above to see the member forms.',
      soloTeam: 'You are registering alone, as a team of one.',
      leader: 'Leader', none: 'None',
      slotDay: 'Day', slotTime: 'Time', slotFull: 'Fully booked', slotsLeft: '{n} left', slotMove: 'Your time now, {was}, is given up when you save, and anyone can book it then.', slotNone: 'No free slots on this day.', slotPick: 'Pick a day to see the times.',
      hintArabic: 'Arabic letters only', hintEnglish: 'English letters only', hintDigits: 'Digits only',
      fixErrors: 'Fix the highlighted answers to continue.',
      themeToggle: 'Switch light and dark', langToggle: 'العربية',
      ticketTitle: 'Registration received', ticketRef: 'Reference', ticketKey: 'Your key',
      ticketKeyNote: 'Save this key. You need it to edit or cancel your registration.',
      ticketValid: 'Valid until {date}', ticketNoKey: 'Your registration is saved.', ticketTeamKey: 'Your team\'s key opens this booking, to change its time or cancel it.',
      ticketShot: 'Take a screenshot of this page now. The key is shown only once.',
      saveImage: 'Save as image', savePdf: 'Save as PDF', copyKey: 'Copy key', copied: 'Copied',
      imageFail: 'Could not make the image. Take a screenshot instead.', done: 'Done', emailSent: 'A copy was sent to {email}.',
      editLink: 'Already registered? Edit or cancel with your key',
      teamStep: 'Your team', teamHelp: 'Type the 5-digit key you got when you registered in "{form}". Your details are filled in for you.',
      findTeam: 'Find my team', teamIs: 'This is your team', teamLeader: 'Team leader', teamCode: 'Leader code', teamProject: 'Project',
      teamPeople: 'Team', teamPeopleN: '{n} people', teamSolo: 'One person', teamMates: 'Teammates', otherKey: 'Use another key',
      teamBooked: 'Your team already has a booking.', teamBookedAt: 'Your team is booked for {when}.', moveTime: 'Change the time',
      editTitle: 'Open your registration', editHelp: 'Type the 5-digit key you saved when you registered.',
      editOpen: 'Open my registration', keyLabel: 'Your key', editing: 'Editing {ref}', keyUntil: 'Key valid until {date}',
      done: 'Done', undo: 'Undo', memberRemoved: 'Team member {n} was removed.', yourRegistration: 'Your registration',
      yourRegistrationHelp: 'Choose Change next to the part you want to correct. Nothing is saved until you choose Save changes.',
      yourBookingHelp: 'Only the time of a booking can change. Choose Change next to it. Nothing is saved until you choose Save changes.',
      noChanges: 'Nothing is changed yet.',
      closeEdit: 'Close', closeUnsaved: 'Close without saving', leaveTitle: 'Close without saving?', leaveBody: 'The changes you made are not saved.', leaveYes: 'Close', leaveNo: 'Keep editing',
      listSep: ', ',
      transferTitle: 'Already in another team',
      transferBody: '{list}. You can ask the leader of that team to release them. Your team is saved now without them, and they join it when the leader approves.',
      transferAsk: 'Ask the leader', transferNo: 'Go back',
      transferLeaderPhone: 'Leader of team {team}:', copyNumber: 'Copy number', copyFail: 'Could not copy. Select the number and copy it.', openWhatsapp: 'Open in WhatsApp',
      transferLeads: '(leads that team)', transferBodyLeader: 'A leader who agrees hands their team to one of its members first.',
      transferAlone: '{list} cannot be asked for: they lead a team with no other member.',
      transferSent: 'Request sent: {list}. Your team is registered without them until the leader of that team approves.',
      transferAskedTitle: 'A team asks for one of your members',
      transferAskedBody: 'Team {team} asks for {who} to move to it.',
      transferSizeAfter: 'If you approve, you will be a team of {n}.', transferUnderMin: 'That is under the minimum of {min}; the instructor will be told.',
      transferApprove: 'Approve', transferReject: 'Reject', transferLater: 'Later', transferAnswer: 'Answer',
      transferApproved: '{who} moved to team {team}.', transferRejected: '{who} stays on your team.', transferStayed: 'You stay on your team.',
      transferAskedYouTitle: 'A team asks for you', transferAskedYou: 'Team {team} asks for you to move to it.',
      handoverChoose: 'You lead this team, so choose who leads it after you.',
      handoverAlone: 'You are the only one in this team, so there is nobody to lead it after you.',
      handoverWho: 'New leader', handoverEmail: 'Email of the new leader', handoverPick: 'Choose the new leader.',
      handoverSizeAfter: 'After you move, this is a team of {n}.', handoverApprove: 'Hand over and move',
      movedTitle: 'You moved to team {team}',
      movedBody: '{who} leads team {ref} now. Give them its edit key, {key}. The key did not change, and you no longer need it.',
      transferSaveFirst: 'Save your changes first, then answer the request.',
      transferWaiting: 'Waiting for team {team} to release {who}.', transferCancel: 'Cancel request',
      transferJoined: '{who} joined your team.', transferKept: 'Team {team} kept {who}.', transferElsewhere: '{who} joined another team.',
      saveChanges: 'Save changes', cancelReg: 'Cancel registration', cancelTitle: 'Cancel this registration?',
      cancelBody: 'Your place is released and you can register again.', cancelYes: 'Yes, cancel it', cancelNo: 'Keep it',
      cancelledTitle: 'Registration cancelled', cancelledBody: 'You can fill in the form again if you need to.',
      savedTitle: 'Changes saved', readOnly: 'Changes are not allowed for this form. You can cancel and register again.', deadlineLocked: 'The deadline has passed, so this task can no longer be changed or cancelled.',
      backToForm: 'Back to the form', newRegistration: 'Register again',
      errors: {
        required: 'This field is required.', invalid_email: 'Enter a valid email address.',
        arabic_only: 'Use Arabic letters only.', arabic_parts: 'Enter at least {min} names, in Arabic.',
        english_only: 'Use English letters only.', too_short: 'Write at least {min} characters.', too_long: 'Keep it under {max} characters.',
        invalid_phone: 'Enter an Egyptian mobile number, like 01012345678.', invalid_code: 'The code is {length} digits.',
        invalid_choice: 'Choose one of the options.', invalid_link: 'Paste a Google Drive link.',
        link_kind: 'This link should point to: {kinds}.',
        link_unreachable: 'This link does not open. Check it and share it with "Anyone with the link".',
        link_not_public: 'Share this file with "Anyone with the link", then try again.',
        folder_name_spaces: 'The folder is named "{name}", which has spaces. Rename it in Drive with underscores, like {example}.',
        folder_name_format: 'The folder is named "{name}". Rename it in Drive as the team leader\'s name, the project name, and the subject name joined by underscores, like {example}.',
        folder_name_subject: 'The folder name must end with _{subject}. Rename it in Drive, like {example}.',
        invalid_slot: 'Pick a day and a time.', too_many_members: 'A team can have {max} extra members at most.',
        too_few_members: 'Add at least {min} team members.',
        invalid_team_size: 'Choose a team size from {min} to {max}.', members_count: 'Fill in all {count} team member forms.',
        bad_team_size: 'Team size must be between 1 and 20.', members_invalid: 'Check the team members.',
        duplicate_code: 'This code is already in your team.',
        duplicate: 'This code is already registered. Use your key to edit it.',
        duplicate_member: 'Someone in this team is already registered in another team.',
        transfer_gone: 'This request was already answered.', transfer_full: 'The team that asked is full now.', transfer_leader: 'This student leads a team alone and cannot be moved.',
        transfer_heir: 'Choose who leads the team after this student.', transfer_email: 'Write the email of the new leader.',
        slot_taken: 'That time was just taken. Pick another.', form_full: 'This form is full.',
        already_booked: 'Your team already has a booking. Open it with your key to change its time.',
        key_booking_off: 'This form no longer takes keys. Reload the page.',
        bad_key: 'That key is not right.', key_expired: 'This key has expired. Ask your instructor to extend it, or to make the change for you.',
        too_many_attempts: 'Too many tries. Wait a minute and try again.', key_disabled: 'Editing with a key is turned off.',
        edit_disabled: 'Editing is turned off for this form.', delete_disabled: 'Cancelling is turned off for this form.',
        form_closed: 'This form is closed.', deadline_passed: 'The deadline has passed, so this task can no longer be changed.', form_not_yet: 'This form has not opened yet.', form_draft: 'This form is not available yet.',
        busy: 'The server is busy. Try again in a moment.', network: 'Could not reach the server. Check your connection and try again.',
        invalid: 'Some answers need fixing.', server_error: 'Something went wrong. Try again.', bad_response: 'The server sent an unexpected answer.',
        not_configured: 'The website is not connected to the backend yet.'
      }
    },
    ar: {
      loading: 'جاري فتح الفورم...',
      notFound: 'الفورم ده مش موجود. راجع اللينك وجرب تاني.',
      connError: 'مقدرناش نوصل للسيرفر. اتأكد من النت وجرب تاني.',
      retry: 'جرب تاني',
      closed: 'الفورم ده مقفول.', notYet: 'الفورم لسه مفتحش.', draft: 'الفورم ده لسه مش متاح.',
      next: 'التالي', back: 'رجوع', submit: 'ابعت التسجيل', book: 'أكّد الحجز', submitting: 'جاري الإرسال...',
      stepOf: 'خطوة {n} من {total}', treasure: 'الكنز!', reviewStep: 'مراجعة', reviewTitle: 'راجع بياناتك',
      reviewHelp: 'اتأكد إن كل حاجة صح قبل ما تبعت.', reviewHelpKey: 'اتأكد إن كل حاجة صح. تقدر تعدل بعدين بالمفتاح.',
      optional: 'اختياري', change: 'تعديل', choose: 'اختار...',
      onlyFor: 'الفورم ده لطلاب {names} بس', and: ' و',
      folderRule: 'سمّي الفولدر: اسم قائد الفريق ثم اسم المشروع ثم اسم المادة، زي {example}: من غير مسافات، وبين كل جزء _.',
      addMember: 'أضف عضو للفريق', removeMember: 'احذف', memberN: 'عضو الفريق {n}', teamSize: 'فريق من {n}',
      pickSize: 'اختار عدد أعضاء الفريق فوق عشان تظهر استمارات الأعضاء.',
      soloTeam: 'انت بتسجل لوحدك، كفريق من فرد واحد.',
      leader: 'القائد', none: 'لا يوجد',
      slotDay: 'اليوم', slotTime: 'الميعاد', slotFull: 'محجوز بالكامل', slotsLeft: 'فاضي {n}', slotMove: 'ميعادك الحالي، {was}، هيتساب لما تحفظ، وأي حد يقدر يحجزه بعدها.', slotNone: 'مفيش مواعيد فاضية في اليوم ده.', slotPick: 'اختار يوم عشان تشوف المواعيد.',
      hintArabic: 'حروف عربي بس', hintEnglish: 'حروف إنجليزي بس', hintDigits: 'أرقام بس',
      fixErrors: 'صلّح الإجابات المعلّمة عشان تكمل.',
      themeToggle: 'بدّل بين الفاتح والداكن', langToggle: 'English',
      ticketTitle: 'تم استلام تسجيلك', ticketRef: 'الرقم المرجعي', ticketKey: 'مفتاحك',
      ticketKeyNote: 'احتفظ بالمفتاح ده. هتحتاجه عشان تعدل أو تلغي تسجيلك.',
      ticketValid: 'صالح لحد {date}', ticketNoKey: 'تم حفظ تسجيلك.', ticketTeamKey: 'مفتاح فريقك بيفتح الحجز ده، عشان تغير ميعاده أو تلغيه.',
      ticketShot: 'صوّر الصفحة دلوقتي. المفتاح بيظهر مرة واحدة بس.',
      saveImage: 'احفظ كصورة', savePdf: 'احفظ PDF', copyKey: 'انسخ المفتاح', copied: 'تم النسخ',
      imageFail: 'مقدرناش نعمل الصورة. خد سكرين شوت.', done: 'تمام', emailSent: 'اتبعتلك نسخة على {email}.',
      editLink: 'مسجل قبل كده؟ عدّل أو الغي بالمفتاح',
      teamStep: 'فريقك', teamHelp: 'اكتب المفتاح المكوّن من 5 أرقام اللي أخدته لما سجلت في "{form}". بياناتك هتتملى لوحدها.',
      findTeam: 'هات فريقي', teamIs: 'ده فريقك', teamLeader: 'قائد الفريق', teamCode: 'كود القائد', teamProject: 'المشروع',
      teamPeople: 'الفريق', teamPeopleN: '{n} أفراد', teamSolo: 'فرد واحد', teamMates: 'زمايلك في الفريق', otherKey: 'استخدم مفتاح تاني',
      teamBooked: 'فريقك حاجز ميعاد بالفعل.', teamBookedAt: 'فريقك حاجز {when}.', moveTime: 'غيّر الميعاد',
      editTitle: 'افتح تسجيلك', editHelp: 'اكتب المفتاح المكوّن من 5 أرقام اللي حفظته وقت التسجيل.',
      editOpen: 'افتح تسجيلي', keyLabel: 'مفتاحك', editing: 'تعديل {ref}', keyUntil: 'المفتاح صالح لحد {date}',
      done: 'تم', undo: 'تراجع', memberRemoved: 'تم حذف عضو الفريق {n}.', yourRegistration: 'تسجيلك',
      yourRegistrationHelp: 'دوس "تعديل" جنب الجزء اللي عايز تصححه. مفيش حاجة بتتحفظ غير لما تدوس "احفظ التعديلات".',
      yourBookingHelp: 'الميعاد بس هو اللي يتغير في الحجز. دوس "تعديل" جنبه. مفيش حاجة بتتحفظ غير لما تدوس "احفظ التعديلات".',
      noChanges: 'مفيش تعديلات لسه.',
      closeEdit: 'اقفل', closeUnsaved: 'اقفل من غير حفظ', leaveTitle: 'تقفل من غير ما تحفظ؟', leaveBody: 'التعديلات اللي عملتها مش هتتحفظ.', leaveYes: 'اقفل', leaveNo: 'كمّل تعديل',
      listSep: '، ',
      transferTitle: 'مسجل في فريق تاني',
      transferBody: '{list}. تقدر تطلب من قائد الفريق ده إنه يسيبه. فريقك هيتسجل دلوقتي من غيره، وهينضم لما القائد يوافق.',
      transferAsk: 'اطلب من القائد', transferNo: 'رجوع',
      transferLeaderPhone: 'قائد فريق {team}:', copyNumber: 'انسخ الرقم', copyFail: 'النسخ منفعش. حدد الرقم وانسخه.', openWhatsapp: 'افتح في واتساب',
      transferLeads: '(قائد الفريق ده)', transferBodyLeader: 'القائد لو وافق هيسلّم فريقه لواحد من أعضائه الأول.',
      transferAlone: '{list} مينفعش يتطلب: هو قائد فريق مفيهوش أعضاء غيره.',
      transferSent: 'الطلب اتبعت: {list}. فريقك متسجل من غيره لحد ما قائد الفريق التاني يوافق.',
      transferAskedTitle: 'فريق بيطلب واحد من أعضاء فريقك',
      transferAskedBody: 'فريق {team} بيطلب إن {who} ينتقل له.',
      transferSizeAfter: 'لو وافقت، فريقك هيبقى {n}.', transferUnderMin: 'ده أقل من الحد الأدنى {min}؛ المحاضر هيتبلغ.',
      transferApprove: 'موافقة', transferReject: 'رفض', transferLater: 'بعدين', transferAnswer: 'رد',
      transferApproved: '{who} انتقل لفريق {team}.', transferRejected: '{who} فاضل في فريقك.', transferStayed: 'إنت فاضل في فريقك.',
      transferAskedYouTitle: 'فريق بيطلبك', transferAskedYou: 'فريق {team} بيطلب إنك تنتقل له.',
      handoverChoose: 'إنت قائد الفريق ده، فاختار مين يقوده بعدك.',
      handoverAlone: 'إنت لوحدك في الفريق ده، فمفيش حد يقوده بعدك.',
      handoverWho: 'القائد الجديد', handoverEmail: 'بريد القائد الجديد', handoverPick: 'اختار القائد الجديد.',
      handoverSizeAfter: 'بعد ما تنتقل، الفريق ده هيبقى {n}.', handoverApprove: 'سلّم وانتقل',
      movedTitle: 'انتقلت لفريق {team}',
      movedBody: '{who} بقى قائد فريق {ref}. اديله مفتاح التعديل بتاعه {key}. المفتاح متغيرش، وإنت مبقتش محتاجه.',
      transferSaveFirst: 'احفظ تعديلاتك الأول، وبعدين رد على الطلب.',
      transferWaiting: 'مستنيين فريق {team} يسيب {who}.', transferCancel: 'إلغاء الطلب',
      transferJoined: '{who} انضم لفريقك.', transferKept: 'فريق {team} احتفظ بـ {who}.', transferElsewhere: '{who} انضم لفريق تاني.',
      saveChanges: 'احفظ التعديلات', cancelReg: 'إلغاء التسجيل', cancelTitle: 'تلغي التسجيل ده؟',
      cancelBody: 'مكانك هيتحرر وتقدر تسجل تاني.', cancelYes: 'أيوه، الغيه', cancelNo: 'سيبه',
      cancelledTitle: 'تم إلغاء التسجيل', cancelledBody: 'تقدر تملى الفورم تاني لو محتاج.',
      savedTitle: 'تم حفظ التعديلات', readOnly: 'التعديل مش مسموح في الفورم ده. تقدر تلغي وتسجل من جديد.', deadlineLocked: 'الميعاد النهائي عدّى، فمينفعش تعدّل التاسك أو تلغيه.',
      backToForm: 'رجوع للفورم', newRegistration: 'سجل من جديد',
      errors: {
        required: 'الخانة دي مطلوبة.', invalid_email: 'اكتب بريد إلكتروني صحيح.',
        arabic_only: 'استخدم حروف عربي بس.', arabic_parts: 'اكتب {min} أسماء على الأقل بالعربي.',
        english_only: 'استخدم حروف إنجليزي بس.', too_short: 'اكتب {min} حروف على الأقل.', too_long: 'خليها أقل من {max} حرف.',
        invalid_phone: 'اكتب رقم موبايل مصري زي 01012345678.', invalid_code: 'الكود {length} أرقام.',
        invalid_choice: 'اختار واحد من الاختيارات.', invalid_link: 'الصق لينك Google Drive.',
        link_kind: 'اللينك ده لازم يكون: {kinds}.',
        link_unreachable: 'اللينك ده مش بيفتح. راجعه واعمله شير "Anyone with the link".',
        link_not_public: 'اعمل شير للملف "Anyone with the link" وجرب تاني.',
        folder_name_spaces: 'اسم الفولدر "{name}" فيه مسافات. غيّر اسمه على Drive واستخدم _ بدل المسافة، زي {example}.',
        folder_name_format: 'اسم الفولدر "{name}". سمّيه على Drive: اسم قائد الفريق ثم اسم المشروع ثم اسم المادة وبينهم _، زي {example}.',
        folder_name_subject: 'لازم اسم الفولدر يخلص بـ _{subject}. غيّر اسمه على Drive، زي {example}.',
        invalid_slot: 'اختار يوم وميعاد.', too_many_members: 'الفريق ممكن يزيد {max} أعضاء بالكتير.',
        too_few_members: 'أضف {min} أعضاء على الأقل.',
        invalid_team_size: 'اختار عدد الفريق من {min} لـ {max}.', members_count: 'املا بيانات كل أعضاء الفريق ({count}).',
        bad_team_size: 'عدد الفريق لازم يكون بين 1 و 20.', members_invalid: 'راجع أعضاء الفريق.',
        duplicate_code: 'الكود ده موجود في الفريق بالفعل.',
        duplicate: 'الكود ده مسجل قبل كده. استخدم المفتاح عشان تعدل.',
        duplicate_member: 'حد من الفريق ده مسجل في فريق تاني.',
        transfer_gone: 'الطلب ده اترد عليه قبل كده.', transfer_full: 'الفريق اللي طلب بقى كامل.', transfer_leader: 'الطالب ده قائد فريق لوحده ومينفعش يتنقل.',
        transfer_heir: 'اختار مين يقود الفريق بعد الطالب ده.', transfer_email: 'اكتب بريد القائد الجديد.',
        slot_taken: 'الميعاد ده اتحجز حالًا. اختار غيره.', form_full: 'الفورم ده اكتمل.',
        already_booked: 'فريقك حاجز ميعاد بالفعل. افتح الحجز بالمفتاح عشان تغير ميعاده.',
        key_booking_off: 'الفورم ده مبقاش بيشتغل بالمفتاح. حمّل الصفحة تاني.',
        bad_key: 'المفتاح ده غلط.', key_expired: 'المفتاح انتهت صلاحيته. اطلب من المدرس يمدّه، أو يعدّل لك.',
        too_many_attempts: 'محاولات كتير. استنى دقيقة وجرب تاني.', key_disabled: 'التعديل بالمفتاح متوقف.',
        edit_disabled: 'التعديل متوقف في الفورم ده.', delete_disabled: 'الإلغاء متوقف في الفورم ده.',
        form_closed: 'الفورم ده مقفول.', deadline_passed: 'الميعاد النهائي عدّى، فمينفعش تعدّل التاسك.', form_not_yet: 'الفورم لسه مفتحش.', form_draft: 'الفورم ده لسه مش متاح.',
        busy: 'السيرفر مشغول. جرب بعد لحظة.', network: 'مقدرناش نوصل للسيرفر. اتأكد من النت وجرب تاني.',
        invalid: 'في إجابات محتاجة تصليح.', server_error: 'حصلت مشكلة. جرب تاني.', bad_response: 'السيرفر رد بشكل غير متوقع.',
        not_configured: 'الموقع لسه مش متوصل بالسيرفر.'
      }
    }
  };

  var KEY = 'fp_lang';
  var lang = 'en';

  function store() { try { return window.localStorage; } catch (e) { return null; } }

  function fill(s, params) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return params && params[k] != null ? params[k] : m; });
  }

  function lookup(path) {
    var parts = path.split('.');
    var cur = STR[lang];
    for (var i = 0; i < parts.length; i++) { cur = cur && cur[parts[i]]; }
    if (cur === undefined) {
      cur = STR.en;
      for (var j = 0; j < parts.length; j++) { cur = cur && cur[parts[j]]; }
    }
    return cur === undefined ? path : cur;
  }

  App.i18n = {
    get lang() { return lang; },
    set: function (l, remember) {
      lang = l === 'ar' ? 'ar' : 'en';
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      var s = store();
      if (remember && s) s.setItem(KEY, lang);
    },
    saved: function () { var s = store(); return s ? s.getItem(KEY) : null; },
    t: function (key, params) { return fill(lookup(key), params); },
    /** Picks the right text from a { en, ar } label. */
    L: function (obj) {
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      return obj[lang] || obj.en || obj.ar || '';
    },
    /** Turns a coded error { error, params } into a sentence. */
    err: function (e) {
      if (!e) return '';
      var code = e.error || e.code || 'server_error';
      var params = Object.assign({}, e.params);
      return fill(lookup('errors.' + code), params);
    },
    fmtDate: function (iso) {
      var d = new Date(iso);
      if (isNaN(d)) return String(iso || '');
      try { return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
      catch (e) { return d.toISOString().slice(0, 10); }
    }
  };
})(window.App = window.App || {});
