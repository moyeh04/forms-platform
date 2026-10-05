/**
 * Shared validation rules.
 *
 * One source of truth used by the browser form, the dashboards, the Node
 * tests, and the Apps Script backend (the bundler prepends this file).
 * Everything here is pure: no DOM, no Apps Script services.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Rules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
  var NOT_ARABIC_LETTER_OR_SPACE = /[^\u0621-\u063A\u0641-\u064A\u0671\s]/g;
  var HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F]/;
  var ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

  function latinDigits(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return ARABIC_DIGITS[d]; });
  }

  function isEmpty(v) {
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
  }

  function squash(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  /* ── Arabic names ─────────────────────────────────────────────── */

  /**
   * Strips everything that is not an Arabic letter or a space.
   * Diacritics and tatweel are removed silently; anything else counts as blocked.
   * With final=false the trailing space is kept so people can keep typing.
   */
  function cleanArabicName(raw, final) {
    var s = String(raw == null ? '' : raw).replace(DIACRITICS, '');
    var cleaned = s.replace(NOT_ARABIC_LETTER_OR_SPACE, '');
    var blocked = cleaned.length !== s.length;
    cleaned = cleaned.replace(/^\s+/, '').replace(/\s+/g, ' ');
    if (final) cleaned = cleaned.trim();
    return { value: cleaned, blocked: blocked };
  }

  function arabicNameParts(value, minPartLength) {
    var min = minPartLength || 2;
    return String(value || '').trim().split(/\s+/).filter(function (p) { return p.length >= min; }).length;
  }

  function validateArabicName(raw, opts) {
    opts = opts || {};
    var minParts = opts.minParts == null ? 4 : opts.minParts;
    var c = cleanArabicName(raw, true);
    if (isEmpty(raw)) return { ok: false, error: 'required' };
    if (c.blocked) return { ok: false, error: 'arabic_only' };
    if (!c.value) return { ok: false, error: 'required' };
    if (arabicNameParts(c.value) < minParts) return { ok: false, error: 'arabic_parts', params: { min: minParts } };
    if (c.value.length > 120) return { ok: false, error: 'too_long', params: { max: 120 } };
    return { ok: true, value: c.value };
  }

  /* ── English-only text (project and task titles) ──────────────── */

  function validateEnglishText(raw, opts) {
    opts = opts || {};
    var v = squash(raw);
    if (!v) return { ok: false, error: 'required' };
    if (HAS_ARABIC.test(v)) return { ok: false, error: 'english_only' };
    var min = opts.min || 2;
    var max = opts.max || 120;
    if (v.length < min) return { ok: false, error: 'too_short', params: { min: min } };
    if (v.length > max) return { ok: false, error: 'too_long', params: { max: max } };
    return { ok: true, value: v };
  }

  /* ── Phones ───────────────────────────────────────────────────── */

  /** Returns the canonical Egyptian mobile (01XXXXXXXXX) or '' when it is not one. */
  function normalizePhone(raw) {
    var d = latinDigits(raw).replace(/[^\d+]/g, '');
    if (!d) return '';
    d = d.replace(/^\+/, '').replace(/^00/, '');
    if (d.indexOf('20') === 0 && d.length === 12) d = '0' + d.slice(2);
    else if (d.length === 10 && d.charAt(0) === '1') d = '0' + d;
    return /^01[0125]\d{8}$/.test(d) ? d : '';
  }

  /** Finds every Egyptian mobile number inside free text (a pasted WhatsApp line). */
  function extractPhones(text) {
    var s = latinDigits(text);
    var found = [];
    var re = /\+?\d[\d\s\-().]{8,}\d/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      var p = normalizePhone(m[0]);
      if (p) found.push({ raw: m[0], phone: p });
    }
    return found;
  }

  function validatePhone(raw) {
    if (isEmpty(raw)) return { ok: false, error: 'required' };
    var p = normalizePhone(raw);
    return p ? { ok: true, value: p } : { ok: false, error: 'invalid_phone' };
  }

  /* ── Student codes ────────────────────────────────────────────── */

  function validateCode(raw, opts) {
    opts = opts || {};
    var len = opts.length || 7;
    var v = latinDigits(raw).replace(/\s+/g, '');
    if (!v) return { ok: false, error: 'required' };
    if (!/^\d+$/.test(v) || v.length !== len) return { ok: false, error: 'invalid_code', params: { length: len } };
    return { ok: true, value: v };
  }

  /* ── Email ────────────────────────────────────────────────────── */

  function validateEmail(raw) {
    var v = squash(raw).toLowerCase();
    if (!v) return { ok: false, error: 'required' };
    if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { ok: false, error: 'invalid_email' };
    return { ok: true, value: v };
  }

  /* ── Google Drive / Docs links ────────────────────────────────── */

  function parseDriveLink(url) {
    var u = String(url == null ? '' : url).trim();
    if (!/^https?:\/\//i.test(u)) return { ok: false };
    var host = (u.match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '';
    host = host.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') return { ok: false };
    var id = '';
    var kind = 'file';
    var m;
    if ((m = u.match(/\/folders\/([-\w]{20,})/))) { id = m[1]; kind = 'folder'; }
    else if ((m = u.match(/\/presentation\/d\/([-\w]{20,})/))) { id = m[1]; kind = 'slides'; }
    else if ((m = u.match(/\/document\/d\/([-\w]{20,})/))) { id = m[1]; kind = 'doc'; }
    else if ((m = u.match(/\/spreadsheets\/d\/([-\w]{20,})/))) { id = m[1]; kind = 'sheet'; }
    else if ((m = u.match(/\/file\/d\/([-\w]{20,})/))) { id = m[1]; kind = 'file'; }
    else if ((m = u.match(/[?&]id=([-\w]{20,})/))) { id = m[1]; kind = 'file'; }
    return id ? { ok: true, id: id, kind: kind, url: u } : { ok: false };
  }

  function validateDriveLink(raw, opts) {
    opts = opts || {};
    if (isEmpty(raw)) return { ok: false, error: 'required' };
    var p = parseDriveLink(raw);
    if (!p.ok) return { ok: false, error: 'invalid_link' };
    if (opts.kinds && opts.kinds.length && opts.kinds.indexOf(p.kind) === -1) {
      return { ok: false, error: 'link_kind', params: { kinds: opts.kinds.join(', ') } };
    }
    return { ok: true, value: p.url, meta: { id: p.id, kind: p.kind } };
  }

  /* ── Drive folder names: Team_Leader_Name_Project_Name_Subject_Name ─── */

  /** Turns free text into an underscore part: "Library System" -> "Library_System". */
  function folderPart(s) {
    return String(s == null ? '' : s).trim().replace(/[^A-Za-z0-9\u0600-\u06FF\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  /** An example of a correct folder name, built from what the student typed. */
  function folderNameExample(o) {
    o = o || {};
    return [folderPart(o.name) || 'Ahmed_Mohamed', folderPart(o.project) || 'Project_Name', folderPart(o.subject) || 'Subject_Name'].join('_');
  }

  /**
   * Checks a Drive folder name against Team_Leader_Name_Project_Name_Subject_Name:
   * no spaces, at least three parts (leader name, project, subject) joined by single underscores, and,
   * when a subject name is given, ending with it (case does not matter). The subject
   * name may itself hold underscores, like Software_Engineering.
   */
  function checkFolderName(name, opts) {
    opts = opts || {};
    var n = String(name == null ? '' : name).trim();
    var subject = folderPart(opts.subject);
    var params = { example: folderNameExample({ name: opts.example && opts.example.name, project: opts.example && opts.example.project, subject: subject }), subject: subject, name: n };
    if (/\s/.test(n)) return { ok: false, error: 'folder_name_spaces', params: params };
    var parts = n.split('_');
    if (parts.length < 3 || parts.some(function (p) { return !p; })) return { ok: false, error: 'folder_name_format', params: params };
    var tail = '_' + subject.toLowerCase();
    if (subject && n.toLowerCase().slice(-tail.length) !== tail) return { ok: false, error: 'folder_name_subject', params: params };
    // The leader's name and the project come before the subject name.
    if (subject && n.slice(0, -tail.length).split('_').length < 2) return { ok: false, error: 'folder_name_format', params: params };
    return { ok: true };
  }

  /* ── Slots ────────────────────────────────────────────────────── */

  function toMinutes(hhmm) {
    var m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function fmtTime(mins, style) {
    var h = Math.floor(mins / 60);
    var mm = ('0' + (mins % 60)).slice(-2);
    if (style === '24h') return ('0' + h).slice(-2) + ':' + mm;
    return ((h % 12) || 12) + ':' + mm;
  }

  /**
   * Builds the list of time slots for a day, e.g.
   * generateSlots({ start: '12:30', end: '15:30', length: 20, gap: 5 })
   * gives ["12:30 - 12:50", "12:55 - 1:15", ...] (12-hour style without am/pm).
   */
  function generateSlots(o) {
    var start = toMinutes(o.start);
    var end = toMinutes(o.end);
    var len = Number(o.length);
    var gap = Number(o.gap || 0);
    if (isNaN(start) || isNaN(end) || !(len > 0) || gap < 0 || end <= start) return [];
    var out = [];
    for (var t = start; t + len <= end; t += len + gap) {
      out.push(fmtTime(t, o.style) + ' - ' + fmtTime(t + len, o.style));
    }
    return out;
  }

  function slotKey(dayId, time) {
    return dayId + '|' + time;
  }

  /* ── Form helpers ─────────────────────────────────────────────── */

  function fieldByRole(form, role) {
    var fields = (form && form.fields) || [];
    for (var i = 0; i < fields.length; i++) if (fields[i].role === role) return fields[i];
    return null;
  }

  function valueByRole(form, data, role) {
    var f = fieldByRole(form, role);
    return f && data ? data[f.id] : undefined;
  }

 /** Everyone on a submission: the leader (or the single person) first, then members. */
 function membersOf(form, data) {
   var out = [];
   var name = valueByRole(form, data, 'name');
   if (name) {
     out.push({
       name: name,
       code: valueByRole(form, data, 'code') || '',
       phone: valueByRole(form, data, 'phone') || '',
        section: (data && data.section) || '',
       leader: true
     });
   }
   var mf = fieldByRole(form, 'members');
   var list = mf && mf.enabled !== false && data && Array.isArray(data[mf.id]) ? data[mf.id] : [];
   list.forEach(function (m) {
      out.push({ name: m.name || '', code: m.code || '', phone: m.phone || '', section: m.section || '', leader: false });
   });
   return out;
 }

  /** 'open' | 'not_yet' | 'closed' | 'draft' | 'archived' */
  function formState(form, nowMs) {
    var now = nowMs == null ? Date.now() : nowMs;
    if (!form) return 'closed';
    if (form.status === 'draft') return 'draft';
    if (form.status === 'archived') return 'archived';
    if (form.status === 'closed') return 'closed';
    var o = form.opensAt ? Date.parse(form.opensAt) : NaN;
    var c = form.closesAt ? Date.parse(form.closesAt) : NaN;
    if (!isNaN(o) && now < o) return 'not_yet';
    if (!isNaN(c) && now > c) return 'closed';
    return 'open';
  }

  /* ── Team size ────────────────────────────────────────────────── */

  /** Allowed total team size (leader included) from the form rules. */
  function teamSizeRange(form) {
    var ts = (form && form.rules && form.rules.teamSize) || {};
    var min = parseInt(ts.min, 10);
    var max = parseInt(ts.max, 10);
    if (!(min >= 1)) min = 1;
    if (!(max >= min)) max = Math.max(min, 6);
    return { min: min, max: max };
  }

  /**
   * The note a student sees after choosing a team size, or '' when that size has none.
   * {n} becomes the chosen size and {max} the largest allowed size.
   */
  function teamSizeNotice(form, size, lang) {
    var ts = (form && form.rules && form.rules.teamSize) || {};
    var n = ts.notice;
    var v = parseInt(size, 10);
    if (!n || !Array.isArray(n.sizes) || n.sizes.map(Number).indexOf(v) === -1) return '';
    var text = (n.text && (n.text[lang] || n.text.en || n.text.ar)) || '';
    var max = teamSizeRange(form).max;
    return String(text).replace(/\{n\}/g, String(v)).replace(/\{max\}/g, String(max));
  }

  function validateTeamSize(raw, form) {
    var r = teamSizeRange(form);
    var s = latinDigits(raw).trim();
    var n = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
    if (isNaN(n) || n < r.min || n > r.max) return { ok: false, error: 'invalid_team_size', params: { min: r.min, max: r.max } };
    return { ok: true, value: String(n) };
  }

  /* ── Field and submission validation ──────────────────────────── */

  function optionValues(field) {
    return (field.options || []).map(function (o) { return String(typeof o === 'object' ? o.value : o); });
  }

  function validateField(field, raw, ctx) {
    ctx = ctx || {};
    var t = field.type;
    if (t === 'members') return validateMembers(field, raw, ctx);
    if (t === 'slot') return validateSlot(field, raw, ctx);

    if (isEmpty(raw)) {
      return field.required === false ? { ok: true, value: '' } : { ok: false, error: 'required' };
    }
    var r;
    switch (t) {
      case 'arabic_name': r = validateArabicName(raw, { minParts: field.minParts }); break;
      case 'english_text': r = validateEnglishText(raw, { min: field.min, max: field.max }); break;
      case 'team_size': r = validateTeamSize(raw, ctx.form); break;
      case 'phone': r = validatePhone(raw); break;
      case 'code': r = validateCode(raw, { length: field.length }); break;
      case 'email': r = validateEmail(raw); break;
      case 'drive_link': r = validateDriveLink(raw, { kinds: field.kinds }); break;
      case 'select': {
        var v = String(raw);
        r = optionValues(field).indexOf(v) === -1 ? { ok: false, error: 'invalid_choice' } : { ok: true, value: v };
        break;
      }
      case 'textarea': {
        var tv = String(raw).trim();
        r = tv.length > 2000 ? { ok: false, error: 'too_long', params: { max: 2000 } } : { ok: true, value: tv };
        break;
      }
      default: {
        var sv = squash(raw);
        var max = field.max || 200;
        r = sv.length > max ? { ok: false, error: 'too_long', params: { max: max } } : { ok: true, value: sv };
      }
    }
    return r;
  }

  function validateSlot(field, raw, ctx) {
    var form = ctx.form || {};
    var days = (form.slots && form.slots.days) || [];
    if (!raw || !raw.day || !raw.time) return { ok: false, error: field.required === false ? 'ok' : 'required' };
    for (var i = 0; i < days.length; i++) {
      if (days[i].id === raw.day && (days[i].times || []).indexOf(raw.time) !== -1) {
        return { ok: true, value: { day: raw.day, time: raw.time } };
      }
    }
    return { ok: false, error: 'invalid_slot' };
  }

  function validateMembers(field, raw, ctx) {
    var list = Array.isArray(raw) ? raw : [];
    if (ctx.memberCount != null) {
      // The team size the person chose decides exactly how many members are needed.
      if (list.length !== ctx.memberCount) return { ok: false, error: 'members_count', params: { count: ctx.memberCount } };
    } else {
      var range = teamSizeRange(ctx.form);
      var min = field.min == null ? range.min - 1 : field.min;
      var max = field.max == null ? range.max - 1 : field.max;
      if (list.length < min) return { ok: false, error: 'too_few_members', params: { min: min } };
      if (list.length > max) return { ok: false, error: 'too_many_members', params: { max: max } };
    }
    var errors = {};
    var clean = list.map(function (m, i) {
      var row = {};
      (field.fields || []).forEach(function (sf) {
        if (sf.enabled === false) return;
        var r = validateField(sf, m ? m[sf.id] : undefined, ctx);
        if (!r.ok) errors[i + '.' + sf.id] = { error: r.error, params: r.params };
        else row[sf.id] = r.value;
      });
      return row;
    });
    if (Object.keys(errors).length) return { ok: false, error: 'members_invalid', nested: errors };
    return { ok: true, value: clean };
  }

  /**
   * Validates a whole submission against a form definition.
   * Returns { ok, errors: { fieldId: { error, params, nested } }, data }.
   */
  function validateSubmission(form, data, ctx) {
    ctx = ctx || {};
    ctx.form = form;
    ctx.memberCount = null;
    var out = {};
    var errors = {};

    // The chosen team size fixes how many member forms must be filled in.
    var sizeField = fieldByRole(form, 'team_size');
    var hasSize = !!(sizeField && sizeField.enabled !== false);
    if (hasSize) {
      var sz = validateField(sizeField, data ? data[sizeField.id] : undefined, ctx);
      if (sz.ok) ctx.memberCount = parseInt(sz.value, 10) - 1;
    }

    (form.fields || []).forEach(function (f) {
      if (f.enabled === false) return;
      if (f.type === 'members' && hasSize && ctx.memberCount == null) return;
      var r = validateField(f, data ? data[f.id] : undefined, ctx);
      if (!r.ok) errors[f.id] = { error: r.error, params: r.params, nested: r.nested };
      else out[f.id] = r.value;
    });

    // Nobody may appear twice in the same submission.
    var codeField = fieldByRole(form, 'code');
    var membersField = fieldByRole(form, 'members');
    if (codeField && membersField && !errors[membersField.id] && Array.isArray(out[membersField.id])) {
      var seen = {};
      if (out[codeField.id]) seen[out[codeField.id]] = true;
      var codeSub = (membersField.fields || []).filter(function (sf) { return sf.role === 'code'; })[0];
      if (codeSub) {
        out[membersField.id].forEach(function (m, i) {
          var c = m[codeSub.id];
          if (!c) return;
          if (seen[c]) {
            errors[membersField.id] = errors[membersField.id] || { error: 'members_invalid', nested: {} };
            errors[membersField.id].nested[i + '.' + codeSub.id] = { error: 'duplicate_code' };
          }
          seen[c] = true;
        });
      }
    }

    return { ok: Object.keys(errors).length === 0, errors: errors, data: out };
  }

  return {
    cleanArabicName: cleanArabicName,
    arabicNameParts: arabicNameParts,
    validateArabicName: validateArabicName,
    validateEnglishText: validateEnglishText,
    normalizePhone: normalizePhone,
    extractPhones: extractPhones,
    validatePhone: validatePhone,
    validateCode: validateCode,
    validateEmail: validateEmail,
    parseDriveLink: parseDriveLink,
    validateDriveLink: validateDriveLink,
    generateSlots: generateSlots,
    checkFolderName: checkFolderName,
    folderPart: folderPart,
    folderNameExample: folderNameExample,
    slotKey: slotKey,
    fieldByRole: fieldByRole,
    valueByRole: valueByRole,
    membersOf: membersOf,
    formState: formState,
    validateField: validateField,
    validateSubmission: validateSubmission,
    teamSizeRange: teamSizeRange,
    teamSizeNotice: teamSizeNotice,
    latinDigits: latinDigits,
    isEmpty: isEmpty
  };
});
