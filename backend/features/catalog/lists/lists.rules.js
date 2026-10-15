/** The lists a new registry starts with, and how list values are cleaned. */

var DEFAULT_LISTS = {
  levels: [
    ['صفر / الأولى', 'Level 0 / Year 1'],
    ['الأول / الثانية', 'Level 1 / Year 2'],
    ['الثاني / الثالثة', 'Level 2 / Year 3'],
    ['الثالث / الرابعة', 'Level 3 / Year 4'],
    ['الرابع / الخامسة', 'Level 4 / Year 5']
  ],
  curricula: ['2020', '2018', '2012'],
  majors: [
    ['حاسبات', 'Computers'],
    ['اتصالات', 'Communications'],
    ['عمارة', 'Architecture'],
    ['ميكانيكا', 'Mechanical'],
    ['مدني', 'Civil']
  ],
  sections: [
    '4C-TH1',
    '4C-TH2',
    '4C-TH3',
    '4C-TH4',
    '4C-TH5',
    '4C-TH6',
    '4C-TH7',
    '4C-TH8',
    '4C-T1',
    '4C-T2',
    '4C-T3',
    '4C-O1',
    '4C-O2',
    '4C-O3'
  ],
  groups: ['A', 'B'],
  wa_sections: (function () {
    var a = [];
    for (var i = 1; i <= 33; i++) a.push(String(i));
    return a;
  })()
};

/** Turns ['ar', 'en'] pairs or plain strings into option objects. */
function normalizeListValues(values) {
  return (values || []).map(function (v) {
    if (Array.isArray(v))
      return { value: v[0], label: { ar: v[0], en: v[1] || v[0] } };
    if (v && typeof v === 'object')
      return {
        value: String(v.value),
        label: v.label || { en: String(v.value), ar: String(v.value) }
      };
    return { value: String(v), label: { en: String(v), ar: String(v) } };
  });
}
