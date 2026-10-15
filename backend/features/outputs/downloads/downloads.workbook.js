/** The Excel workbook a Download all job puts beside the files. */

var DownloadsWorkbook = (function () {
  /** The style index of the header cells. */
  var HEAD_ = 1;

  /** The first style index of the tint groups; 0 is the plain style. */
  var GROUP_START_ = 2;

  /** How many styles each tint group has. */
  var GROUP_STYLES_ = 5;

  /** Where each style sits in its group. */
  var IN_GROUP_ = { name: 0, number: 2, code: 2, task: 4 };

  /** The height of a team row, in points. */
  var ROW_HEIGHT_ = 24;

  /** A code made of digits that does not start with 0, which Excel keeps. */
  var PLAIN_NUMBER_ = /^[1-9]\d*$/;

  /**
   * Makes the styles of the workbook: the header, five for each tint group,
   * then wrapped text.
   *
   * @return {!Array<!Object>} The styles.
   */
  function styles_() {
    var styles = [
      {
        fill: SheetStyle.PALETTE.ink,
        color: SheetStyle.PALETTE.onInk,
        bold: true,
        align: 'center'
      }
    ];
    SheetStyle.PALETTE.groups.forEach(function (g) {
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
    return styles;
  }

  /**
   * Gives the style index of a cell of a team.
   *
   * @param {number} g The team's place in the list.
   * @param {number} k The style's place in its group.
   * @return {number} The index.
   */
  function groupStyle_(g, k) {
    var groups = SheetStyle.PALETTE.groups.length;
    return GROUP_START_ + (g % groups) * GROUP_STYLES_ + k;
  }

  /**
   * Gives the style index of wrapped text, after the groups.
   *
   * @return {number} The index.
   */
  function wrapStyle_() {
    return GROUP_START_ + SheetStyle.PALETTE.groups.length * GROUP_STYLES_;
  }

  /**
   * Makes a header row.
   *
   * @param {!Array<string>} names The headers.
   * @return {!Array<!Object>} The cells.
   */
  function headRow_(names) {
    return names.map(function (v) {
      return { v: v, style: HEAD_ };
    });
  }

  /**
   * Finds the saved copy of a team's things and links to it inside the zip.
   *
   * @param {!Array<string>} paths The paths of the saved files.
   * @param {string} base Where the team's things go.
   * @return {string} The relative link, or empty when nothing was saved.
   */
  function localLink_(paths, base) {
    var hit = paths.filter(function (p) {
      return (
        p === base || p.indexOf(base + '.') === 0 || p.indexOf(base + '/') === 0
      );
    })[0];
    if (!hit) return '';
    var target = hit.indexOf(base + '/') === 0 ? base + '/' : hit;
    return target.split('/').map(encodeURIComponent).join('/');
  }

  /**
   * Makes the row of one member, with the team number and task on the
   * first member's row.
   *
   * @param {!Object} t The team.
   * @param {number} g The team's place in the list.
   * @param {!Object} m The member.
   * @param {number} i The member's place in the team.
   * @return {!Array<!Object>} The cells.
   */
  function memberRow_(t, g, m, i) {
    var first = i === 0;
    var shade = i % 2;
    var code = groupStyle_(g, IN_GROUP_.code + shade);
    var task = groupStyle_(g, IN_GROUP_.task);
    return [
      { v: first ? t.number : '', style: groupStyle_(g, IN_GROUP_.number) },
      {
        v: i + 1 + '. ' + m.name + (m.leader ? ' ★' : ''),
        style: groupStyle_(g, IN_GROUP_.name + shade)
      },
      // A code that starts with 0 stays text, or Excel would drop the zero.
      {
        v: PLAIN_NUMBER_.test(String(m.code)) ? Number(m.code) : m.code,
        style: code
      },
      { v: m.section || '', style: code },
      first
        ? { v: t.title || t.ref, style: task, link: t.localLink }
        : { v: '', style: task }
    ];
  }

  /**
   * Makes the Teams sheet: every team with its members, and its task or
   * project linked to the saved copy.
   *
   * @param {!Object} form The form.
   * @param {!Object<string, *>} saved The saved files by path.
   * @return {!Object} The sheet.
   */
  function teamsSheet_(form, saved) {
    var paths = Object.keys(saved);
    var rows = [
      headRow_(
        ['#', 'Team member', 'Code', 'Section'].concat(
          TeamsService.teamThing(form)
        )
      )
    ];
    var merges = [];
    TeamsService.teamBlocks(form).forEach(function (t, g) {
      var start = rows.length + 1;
      var end = start + t.members.length - 1;
      var linked = Object.assign({}, t, {
        localLink:
          localLink_(paths, DownloadsJobs.teamBase(form, t)) || t.link || ''
      });
      t.members.forEach(function (m, i) {
        rows.push(memberRow_(linked, g, m, i));
      });
      if (t.members.length > 1) {
        merges.push('A' + start + ':A' + end, 'E' + start + ':E' + end);
      }
    });
    return { name: 'Teams', rows: rows, merges: merges, heights: ROW_HEIGHT_ };
  }

  /**
   * Makes the sheet of the files that could not be saved.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} failed The files and why.
   * @return {!Object} The sheet.
   */
  function failedSheet_(form, failed) {
    var wrap = wrapStyle_();
    var head = headRow_([
      '#',
      TeamsService.teamThing(form),
      'File',
      'Why',
      'Open in Drive'
    ]);
    return {
      name: 'Not downloaded',
      rows: [head].concat(
        failed.map(function (f) {
          return [
            f.number,
            { v: f.title || '', style: wrap },
            { v: f.path, style: wrap },
            { v: f.reason, style: wrap },
            f.url ? { v: 'Open', link: f.url } : ''
          ];
        })
      )
    };
  }

  /**
   * Makes the workbook: the teams and, when some files could not be saved,
   * a sheet of those.
   *
   * @param {!Object} form The form.
   * @param {!Object} job The job, with its `failed` files.
   * @param {!Object<string, *>} saved The saved files by path.
   * @return {!Blob} The .xlsx file.
   */
  function build(form, job, saved) {
    var sheets = [teamsSheet_(form, saved)];
    if (job.failed.length) sheets.push(failedSheet_(form, job.failed));
    return Workbook.xlsxBlob('Teams.xlsx', sheets, styles_());
  }

  return { build };
})();
