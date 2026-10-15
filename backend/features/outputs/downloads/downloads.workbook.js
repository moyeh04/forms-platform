/** The Excel workbook a Download all job puts beside the files. */

/** The workbook: every team with its members, and its task or project linked to the saved copy. */
function dlWorkbook_(form, job, saved) {
  var thing = teamThing_(form);
  var styles = [
    {
      fill: VIEW_STYLE_.ink,
      color: VIEW_STYLE_.onInk,
      bold: true,
      align: 'center'
    }
  ];
  VIEW_STYLE_.groups.forEach(function (g) {
    styles.push(
      { fill: g.shades[0], bold: true, align: 'right', rtl: true },
      { fill: g.shades[1], bold: true, align: 'right', rtl: true },
      { fill: g.shades[0], bold: true, align: 'center' },
      { fill: g.shades[1], bold: true, align: 'center' },
      {
        fill: g.solid,
        color: '#FFFFFF',
        bold: true,
        underline: true,
        align: 'center',
        wrap: true
      }
    );
  });
  styles.push({ wrap: true });
  var ST = { head: 1, wrap: 2 + VIEW_STYLE_.groups.length * 5 };
  var group = function (g, k) {
    return 2 + (g % VIEW_STYLE_.groups.length) * 5 + k;
  };
  var paths = Object.keys(saved);
  var localLink = function (base) {
    var hit = paths.filter(function (p) {
      return (
        p === base || p.indexOf(base + '.') === 0 || p.indexOf(base + '/') === 0
      );
    })[0];
    if (!hit) return '';
    var target = hit.indexOf(base + '/') === 0 ? base + '/' : hit;
    return target.split('/').map(encodeURIComponent).join('/');
  };

  var rows = [
    [
      { v: '#', style: ST.head },
      { v: 'Team member', style: ST.head },
      { v: 'Code', style: ST.head },
      { v: 'Section', style: ST.head },
      { v: thing, style: ST.head }
    ]
  ];
  var merges = [];
  teamBlocks_(form).forEach(function (t, g) {
    var start = rows.length + 1;
    var link = localLink(dlBase_(form, t)) || t.link || '';
    t.members.forEach(function (m, i) {
      rows.push([
        i === 0
          ? { v: t.number, style: group(g, 2) }
          : { v: '', style: group(g, 2) },
        {
          v: i + 1 + '. ' + m.name + (m.leader ? ' ★' : ''),
          style: group(g, i % 2)
        },
        // A code that starts with 0 stays text, or Excel would drop the zero.
        {
          v: /^[1-9]\d*$/.test(String(m.code)) ? Number(m.code) : m.code,
          style: group(g, 2 + (i % 2))
        },
        { v: m.section || '', style: group(g, 2 + (i % 2)) },
        i === 0
          ? { v: t.title || t.ref, style: group(g, 4), link: link }
          : { v: '', style: group(g, 4) }
      ]);
    });
    if (t.members.length > 1) {
      merges.push('A' + start + ':A' + (start + t.members.length - 1));
      merges.push('E' + start + ':E' + (start + t.members.length - 1));
    }
  });
  var sheets = [{ name: 'Teams', rows: rows, merges: merges, heights: 24 }];
  if (job.failed.length) {
    sheets.push({
      name: 'Not downloaded',
      rows: [
        [
          { v: '#', style: ST.head },
          { v: thing, style: ST.head },
          { v: 'File', style: ST.head },
          { v: 'Why', style: ST.head },
          { v: 'Open in Drive', style: ST.head }
        ]
      ].concat(
        job.failed.map(function (f) {
          return [
            f.number,
            { v: f.title || '', style: ST.wrap },
            { v: f.path, style: ST.wrap },
            { v: f.reason, style: ST.wrap },
            f.url ? { v: 'Open', link: f.url } : ''
          ];
        })
      )
    });
  }
  return Workbook.xlsxBlob('Teams.xlsx', sheets, styles);
}
