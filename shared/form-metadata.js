var FormMetadata = (function () {
  'use strict';

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function yearFromTerm(term) {
    var value = text(term);
    var academicYear = value.match(/(?:^|\s)(\d{4})\/(\d{4})$/);
    if (academicYear) return academicYear[1] + '/' + academicYear[2];
    var season = value.match(/^(fall|spring|summer)\s+(\d{4})$/i);
    if (season) {
      var start = parseInt(season[2], 10) + (/^(spring|summer)$/i.test(season[1]) ? -1 : 0);
      return String(start) + '/' + String(start + 1);
    }
    var match = value.match(/(?:^|\s)(\d{4})$/);
    return match ? match[1] + '/' + (parseInt(match[1], 10) + 1) : '';
  }

  function academicYears(current) {
    var year = new Date().getFullYear(), years = [String(year) + '/' + String(year + 1), String(year - 1) + '/' + String(year)];
    for (var y = year + 1; y <= year + 4; y++) years.push(String(y) + '/' + String(y + 1));
    for (var past = year - 2; past >= year - 6; past--) years.push(String(past) + '/' + String(past + 1));
    if (current && years.indexOf(String(current)) === -1) years.unshift(String(current));
    return years;
  }

  function academicYear(value) {
    var year = text(value).match(/^(\d{4})$/);
    return year ? year[1] + '/' + (parseInt(year[1], 10) + 1) : yearFromTerm(value);
  }

  function legacyAcademicYear(term) {
    var match = text(term).match(/^(fall|spring|summer)\s+(\d{4})$/i);
    if (!match) return academicYear(term);
    var year = parseInt(match[2], 10) + (match[1].toLowerCase() === 'fall' ? 0 : -1);
    return String(year) + '/' + String(year + 1);
  }

  function subjectCode(value) {
    return text(value).replace(/\s+/g, '').replace(/[^A-Za-z0-9\-]/g, '').slice(0, 20);
  }

  function subjectTerm(form) {
    return { term: text(form && form.term), subject: text(form && form.subject) };
  }

  var subjectAdapter = {
    editor: 'term-subject',
    duplicateAction: 'Duplicate for a new term',
    fields: ['term', 'subject'],
    legacyFields: [],
    defaults: function () {
      return { term: 'Fall ' + academicYears()[0], subject: '' };
    },
    read: subjectTerm,
    create: function (values) {
      return { term: text(values.term), subject: subjectCode(values.subject) };
    },
    duplicate: function (form, values) {
      return { term: own(values, 'term') ? text(values.term) : text(form.term), subject: own(values, 'subject') ? subjectCode(values.subject) : text(form.subject) };
    },
    update: function (form, patch) {
      if (own(patch, 'term')) form.term = text(patch.term);
      if (own(patch, 'subject')) form.subject = subjectCode(patch.subject);
    },
    applyUpdate: function (form, patch) { this.update(form, patch); },
    public: subjectTerm,
    display: function (form) {
      var metadata = subjectTerm(form);
      return [
        metadata.subject ? { key: 'subject', value: metadata.subject, variant: 'subject' } : null,
        metadata.term ? { key: 'term', value: metadata.term, variant: 'term' } : null
      ].filter(Boolean);
    },
    caption: function (form) { return subjectTerm(form).term; },
    slug: function (form) { return subjectTerm(form).term; },
    sheet: function (form) { return subjectTerm(form).term; }
  };

  function batchYear(form) {
    return academicYear(form && form.batchYear) || legacyAcademicYear(form && form.term);
  }

  var batchAdapter = {
    editor: 'batch-year',
    fields: ['batchYear'],
    legacyFields: ['term', 'subject'],
    defaults: function () {
      return { batchYear: academicYears()[0] };
    },
    read: function (form) { return { batchYear: batchYear(form) }; },
    create: function (values) {
      return { term: '', batchYear: academicYear(values.batchYear) || legacyAcademicYear(values.term) };
    },
    duplicate: function (form, values) {
      return { term: '', batchYear: academicYear(values.batchYear) || batchYear(form) };
    },
    update: function (form, patch) {
      if (own(patch, 'batchYear')) form.batchYear = academicYear(patch.batchYear);
      else if (own(patch, 'term')) form.batchYear = legacyAcademicYear(patch.term);
    },
    public: function (form) { return { batchYear: batchYear(form) }; },
    display: function (form) {
      var year = batchYear(form);
      return year ? [{ key: 'batchYear', value: 'Batch ' + year, variant: 'term' }] : [];
    },
    caption: function (form) {
      var year = batchYear(form);
      return year ? 'Batch ' + year : '';
    },
    slug: batchYear,
    sheet: function (form) {
      var year = batchYear(form);
      return year ? 'Batch ' + year : '';
    }
  };

  var types = {
    team_registration: subjectAdapter,
    task_submission: subjectAdapter,
    reservation: subjectAdapter,
    whatsapp_registration: batchAdapter
  };

  function forType(type) {
    return types[type] || subjectAdapter;
  }

  return {
    forType: forType,
    create: function (type, values) { return forType(type).create(values || {}); },
    duplicate: function (form, values) {
      var adapter = forType(form && form.type);
      return adapter.duplicate(form || {}, values || {});
    },
    defaults: function (type) { return forType(type).defaults(); },
    fields: function (type) { return forType(type).fields.slice(); },
    academicYears: academicYears,
    legacyFields: function (type) { return forType(type).legacyFields.slice(); },
    read: function (form) { return forType(form && form.type).read(form || {}); },
    hydrate: function (form) {
      Object.assign(form, forType(form && form.type).read(form || {}));
      return form;
    },
    update: function (form, patch) { return forType(form && form.type).update(form, patch || {}); },
    public: function (form) { return forType(form && form.type).public(form || {}); },
    display: function (form) { return forType(form && form.type).display(form || {}); },
    caption: function (form) { return forType(form && form.type).caption(form || {}); },
    slug: function (form) { return forType(form && form.type).slug(form || {}); },
    sheet: function (form) { return forType(form && form.type).sheet(form || {}); }
  };
})();
