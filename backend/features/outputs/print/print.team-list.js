/**
 * The print tab of everyone, team by team: each member on a row, with the
 * team number and the task merged down the side of the team.
 */

var PrintTeamList = (function () {
  /** The width of each column, in pixels. */
  var COLUMN_PX_ = {
    team: 70,
    name: 330,
    code: 120,
    task: 300
  };

  /** The widths in column order. */
  var WIDTHS_ = Object.values(COLUMN_PX_);

  /** How many columns the tab has. */
  var COLS_ = WIDTHS_.length;

  /** The height of a member row, in pixels. */
  var ROW_PX_ = 30;

  /** The column of the member names, which are bold. */
  var NAME_COL_ = 2;

  /** The column of the codes, which are centred. */
  var CODE_COL_ = 3;

  /** The column of the merged task. */
  var TASK_COL_ = 4;

  /** The mark after the name of a team leader. */
  var LEADER_MARK_ = '  ★';

  /** What a task without a title shows. */
  var NO_TITLE_ = '—';

  /**
   * Makes the rows, their tints and the block of each team.
   *
   * @param {!Object} form The form.
   * @return {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>,
   *     blocks: !Array<!Object>}} The rows, tints and blocks.
   */
  function teamRows_(form) {
    var out = { values: [], shades: [], blocks: [] };
    TeamsService.teamBlocks(form).forEach(function (t, g) {
      var tints = SheetStyle.PALETTE.groups[g % 2].shades;
      var start = out.values.length + PrintLayout.FIRST_ROW;
      t.members.forEach(function (m, i) {
        var mark = m.leader ? LEADER_MARK_ : '';
        out.values.push(['', i + 1 + '.  ' + m.name + mark, m.code, '']);
        out.shades.push([tints[0], tints[i % 2], tints[i % 2], tints[0]]);
      });
      out.blocks.push({
        start: start,
        length: t.members.length,
        number: t.number,
        response: t.response
      });
    });
    return out;
  }

  /**
   * Merges the team number and the task down the side of one team.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Object} b The block of the team.
   */
  function labelBlock_(sh, b) {
    var title = b.response.title || NO_TITLE_;
    var link = b.response.link
      ? SheetViewsLayout.hyperlink(b.response.link, title)
      : '';
    var fill = PrintLayout.LABEL_FILL;
    SheetViewsLayout.mergedLabel(
      sh,
      { row: b.start, col: 1, length: b.length },
      { value: b.number, formula: '', fill: fill }
    );
    sh.getRange(b.start, 1).setFontColor(PrintLayout.BLACK);
    SheetViewsLayout.mergedLabel(
      sh,
      { row: b.start, col: TASK_COL_, length: b.length },
      { value: title, formula: link, fill: fill }
    );
    sh.getRange(b.start, TASK_COL_).setFontColor(PrintLayout.BLACK);
  }

  /**
   * Writes the member rows under the header, then labels and frames each
   * team.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>,
   *     blocks: !Array<!Object>}} rows The rows of `teamRows_`.
   */
  function writeRows_(sh, rows) {
    var first = PrintLayout.FIRST_ROW;
    var n = rows.values.length;
    sh.getRange(first, 1, n, COLS_)
      .setValues(rows.values)
      .setBackgrounds(rows.shades)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setFontSize(PrintLayout.BODY_FONT)
      .setVerticalAlignment('middle');
    sh.getRange(first, NAME_COL_, n, 1).setFontWeight('bold');
    sh.getRange(first, CODE_COL_, n, 1).setHorizontalAlignment('center');
    sh.setRowHeights(first, n, ROW_PX_);
    rows.blocks.forEach(function (b) {
      labelBlock_(sh, b);
    });
    var last = n + PrintLayout.HEADER_ROW;
    SheetViewsLayout.frameBlocks(
      sh,
      { cols: COLS_, first: first, last: last },
      rows.blocks
    );
    PrintLayout.frame(
      sh.getRange(PrintLayout.HEADER_ROW, 1, 1, COLS_),
      SheetStyle.PALETTE.ink
    );
  }

  /**
   * Rebuilds the print tab of the team list.
   *
   * @param {!Object} form The form.
   * @return {{sheetName: string, gid: number, count: number,
   *     landscape: boolean}} The tab; the count is the number of teams.
   */
  function printList(form) {
    var vform = FormsPublic.validationForm(form);
    var ss = SpreadsheetApp.openById(form.sheetId);
    var sh = SheetViewsLayout.freshView(ss, 'Print - Team list');
    var headers = ['Team', 'Team member name', 'Code'];
    headers.push(TeamsService.teamThing(form));
    var metadata = FormMetadata.caption(vform);
    var caption = metadata ? '  -  ' + metadata : '';
    PrintLayout.paintHeader(
      sh,
      vform.title + caption + '  -  Team list',
      headers
    );
    PrintLayout.setWidths(sh, WIDTHS_);
    var rows = teamRows_(form);
    if (!rows.values.length) {
      PrintLayout.emptyNote(sh, COLS_, 'No registrations yet.');
      return PrintLayout.printed(sh, 0);
    }
    writeRows_(sh, rows);
    return PrintLayout.printed(sh, rows.blocks.length);
  }

  return { printList };
})();
