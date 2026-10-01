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
      next: 'Next', back: 'Back', submit: 'Submit registration', submitting: 'Sending...',
      stepOf: 'Step {n} of {total}', reviewStep: 'Review', reviewTitle: 'Check your details',
      reviewHelp: 'Make sure everything is right before you send it.', reviewHelpKey: 'Make sure everything is right. You can still fix it later with your key.',
      optional: 'optional', change: 'Change', choose: 'Choose...',
      addMember: 'Add a team member', removeMember: 'Remove', memberN: 'Team member {n}', teamSize: 'Team of {n}',
      pickSize: 'Choose the team size above to see the member forms.',
      soloTeam: 'You are registering as a team of one, so there are no members to add.',
      leader: 'Leader', none: 'None',
      slotDay: 'Day', slotTime: 'Time', slotFull: 'Fully booked', slotNone: 'No free slots on this day.', slotPick: 'Pick a day to see the times.',
      hintArabic: 'Arabic letters only', hintEnglish: 'English letters only', hintDigits: 'Digits only',
      fixErrors: 'Fix the highlighted answers to continue.',
      themeToggle: 'Switch light and dark', langToggle: 'العربية',
      ticketTitle: 'Registration received', ticketRef: 'Reference', ticketKey: 'Your key',
      ticketKeyNote: 'Save this key. You need it to edit or cancel your registration.',
      ticketValid: 'Valid until {date}', ticketNoKey: 'Your registration is saved.',
      ticketShot: 'Take a screenshot of this page now. The key is shown only once.',
      saveImage: 'Save as image', savePdf: 'Save as PDF', copyKey: 'Copy key', copied: 'Copied',
      imageFail: 'Could not make the image. Take a screenshot instead.', done: 'Done', emailSent: 'A copy was sent to {email}.',
      editLink: 'Already registered? Edit or cancel with your key',
      editTitle: 'Open your registration', editHelp: 'Type the 5-digit key you saved when you registered.',
      editOpen: 'Open my registration', keyLabel: 'Your key', editing: 'Editing {ref}', keyUntil: 'Key valid until {date}',
      saveChanges: 'Save changes', cancelReg: 'Cancel registration', cancelTitle: 'Cancel this registration?',
      cancelBody: 'Your place is released and you can register again.', cancelYes: 'Yes, cancel it', cancelNo: 'Keep it',
      cancelledTitle: 'Registration cancelled', cancelledBody: 'You can fill in the form again if you need to.',
      savedTitle: 'Changes saved', readOnly: 'Changes are not allowed for this form. You can cancel and register again.',
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
        invalid_slot: 'Pick a day and a time.', too_many_members: 'A team can have {max} extra members at most.',
        too_few_members: 'Add at least {min} team members.',
        invalid_team_size: 'Choose a team size from {min} to {max}.', members_count: 'Fill in all {count} team member forms.',
        bad_team_size: 'Team size must be between 1 and 20.', members_invalid: 'Check the team members.',
        duplicate_code: 'This code is already in your team.',
        duplicate: 'This code is already registered. Use your key to edit it.',
        duplicate_member: 'Someone in this team is already registered in another team.',
        slot_taken: 'That time was just taken. Pick another.', form_full: 'This form is full.',
        bad_key: 'That key is not right.', key_expired: 'This key has expired. Ask your instructor to change it for you.',
        too_many_attempts: 'Too many tries. Wait a minute and try again.', key_disabled: 'Editing with a key is turned off.',
        edit_disabled: 'Editing is turned off for this form.', delete_disabled: 'Cancelling is turned off for this form.',
        form_closed: 'This form is closed.', form_not_yet: 'This form has not opened yet.', form_draft: 'This form is not available yet.',
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
      next: 'التالي', back: 'رجوع', submit: 'ابعت التسجيل', submitting: 'جاري الإرسال...',
      stepOf: 'خطوة {n} من {total}', reviewStep: 'مراجعة', reviewTitle: 'راجع بياناتك',
      reviewHelp: 'اتأكد إن كل حاجة صح قبل ما تبعت.', reviewHelpKey: 'اتأكد إن كل حاجة صح. تقدر تعدل بعدين بالمفتاح.',
      optional: 'اختياري', change: 'تعديل', choose: 'اختار...',
      addMember: 'أضف عضو للفريق', removeMember: 'احذف', memberN: 'عضو الفريق {n}', teamSize: 'فريق من {n}',
      pickSize: 'اختار عدد أعضاء الفريق فوق عشان تظهر استمارات الأعضاء.',
      soloTeam: 'انت بتسجل كفريق من فرد واحد، فمفيش أعضاء تضيفهم.',
      leader: 'القائد', none: 'لا يوجد',
      slotDay: 'اليوم', slotTime: 'الميعاد', slotFull: 'محجوز بالكامل', slotNone: 'مفيش مواعيد فاضية في اليوم ده.', slotPick: 'اختار يوم عشان تشوف المواعيد.',
      hintArabic: 'حروف عربي بس', hintEnglish: 'حروف إنجليزي بس', hintDigits: 'أرقام بس',
      fixErrors: 'صلّح الإجابات المعلّمة عشان تكمل.',
      themeToggle: 'بدّل بين الفاتح والداكن', langToggle: 'English',
      ticketTitle: 'تم استلام تسجيلك', ticketRef: 'الرقم المرجعي', ticketKey: 'مفتاحك',
      ticketKeyNote: 'احتفظ بالمفتاح ده. هتحتاجه عشان تعدل أو تلغي تسجيلك.',
      ticketValid: 'صالح لحد {date}', ticketNoKey: 'تم حفظ تسجيلك.',
      ticketShot: 'صوّر الصفحة دلوقتي. المفتاح بيظهر مرة واحدة بس.',
      saveImage: 'احفظ كصورة', savePdf: 'احفظ PDF', copyKey: 'انسخ المفتاح', copied: 'تم النسخ',
      imageFail: 'مقدرناش نعمل الصورة. خد سكرين شوت.', done: 'تمام', emailSent: 'اتبعتلك نسخة على {email}.',
      editLink: 'مسجل قبل كده؟ عدّل أو الغي بالمفتاح',
      editTitle: 'افتح تسجيلك', editHelp: 'اكتب المفتاح المكوّن من 5 أرقام اللي حفظته وقت التسجيل.',
      editOpen: 'افتح تسجيلي', keyLabel: 'مفتاحك', editing: 'تعديل {ref}', keyUntil: 'المفتاح صالح لحد {date}',
      saveChanges: 'احفظ التعديلات', cancelReg: 'إلغاء التسجيل', cancelTitle: 'تلغي التسجيل ده؟',
      cancelBody: 'مكانك هيتحرر وتقدر تسجل تاني.', cancelYes: 'أيوه، الغيه', cancelNo: 'سيبه',
      cancelledTitle: 'تم إلغاء التسجيل', cancelledBody: 'تقدر تملى الفورم تاني لو محتاج.',
      savedTitle: 'تم حفظ التعديلات', readOnly: 'التعديل مش مسموح في الفورم ده. تقدر تلغي وتسجل من جديد.',
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
        invalid_slot: 'اختار يوم وميعاد.', too_many_members: 'الفريق ممكن يزيد {max} أعضاء بالكتير.',
        too_few_members: 'أضف {min} أعضاء على الأقل.',
        invalid_team_size: 'اختار عدد الفريق من {min} لـ {max}.', members_count: 'املا بيانات كل أعضاء الفريق ({count}).',
        bad_team_size: 'عدد الفريق لازم يكون بين 1 و 20.', members_invalid: 'راجع أعضاء الفريق.',
        duplicate_code: 'الكود ده موجود في الفريق بالفعل.',
        duplicate: 'الكود ده مسجل قبل كده. استخدم المفتاح عشان تعدل.',
        duplicate_member: 'حد من الفريق ده مسجل في فريق تاني.',
        slot_taken: 'الميعاد ده اتحجز حالًا. اختار غيره.', form_full: 'الفورم ده اكتمل.',
        bad_key: 'المفتاح ده غلط.', key_expired: 'المفتاح انتهت صلاحيته. اطلب من المدرس يعدّل لك.',
        too_many_attempts: 'محاولات كتير. استنى دقيقة وجرب تاني.', key_disabled: 'التعديل بالمفتاح متوقف.',
        edit_disabled: 'التعديل متوقف في الفورم ده.', delete_disabled: 'الإلغاء متوقف في الفورم ده.',
        form_closed: 'الفورم ده مقفول.', form_not_yet: 'الفورم لسه مفتحش.', form_draft: 'الفورم ده لسه مش متاح.',
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
