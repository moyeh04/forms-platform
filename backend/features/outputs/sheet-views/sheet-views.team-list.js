/**
 * The Team Members List view: each team a block of its members, tinted in
 * turn, with its task merged down the side.
 */

var SheetViewsTeamList = (function () {
  /** The width of each column, in pixels. */
  var COLUMN_PX_ = { name: 300, section: 100, code: 110, task: 280 };

  /** The widths in column order. */
  var WIDTHS_ = Object.values(COLUMN_PX_);

  /** How many columns the view has. */
  var COLS_ = WIDTHS_.length;

  /** The column of the merged task. */
  var TASK_COL_ = 4;

  /** The height of a member row, in pixels. */
  var ROW_PX_ = 32;

  /** The mark after the name of a team leader. */
  var LEADER_MARK_ = '  ★';

  /** What a task without a title shows. */
  var NO_TITLE_ = '—';

  /**
   * Makes the rows, their tints and the block of each team.
   *
   * @param {!Array<!Object>} teams The teams of `TeamsService.teamBlocks`.
   * @return {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>,
   *     blocks: !Array<!Object>}} The rows, tints and blocks.
   */
  function teamRows_(teams) {
    var out = { values: [], shades: [], blocks: [] };
    teams.forEach(function (t, g) {
      var style = SheetStyle.PALETTE.groups[g % 2];
      var start = out.values.length + SheetViewsLayout.FIRST_ROW;
      t.members.forEach(function (m, i) {
        var mark = m.leader ? LEADER_MARK_ : '';
        var tint = style.shades[i % 2];
        out.values.push([
          i + 1 + '.  ' + m.name + mark,
          m.section || '',
          m.code,
          ''
        ]);
        out.shades.push([tint, tint, tint, style.solid]);
      });
      out.blocks.push({
        start: start,
        length: t.members.length,
        response: t.response,
        style: style
      });
    });
    return out;
  }

  /**
   * Merges the task of each team down the side of its block.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<!Object>} blocks The blocks.
   */
  function labelTasks_(sh, blocks) {
    blocks.forEach(function (b) {
      var title = b.response.title || NO_TITLE_;
      var link = b.response.link
        ? SheetViewsLayout.hyperlink(b.response.link, title)
        : '';
      SheetViewsLayout.mergedLabel(
        sh,
        { row: b.start, col: TASK_COL_, length: b.length },
        { value: title, formula: link, fill: b.style.solid }
      );
    });
  }

  /**
   * Rebuilds the Team Members List view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function build(form, ss) {
    var sh = SheetViewsLayout.freshView(ss, 'Team Members List');
    SheetViewsLayout.paintHeader(sh, [
      'Team member name',
      'Section',
      'Code',
      TeamsService.teamThing(form)
    ]);
    SheetViewsLayout.setWidths(sh, WIDTHS_);
    var teams = TeamsService.teamBlocks(form);
    if (!teams.length) {
      SheetViewsLayout.emptyView(sh, COLS_, 'No registrations yet.');
      return;
    }
    var rows = teamRows_(teams);
    var first = SheetViewsLayout.FIRST_ROW;
    var n = rows.values.length;
    SheetViewsLayout.writeRows(sh, rows.values, rows.shades);
    sh.getRange(first, 1, n, 1)
      .setFontWeight('bold')
      .setHorizontalAlignment('left');
    sh.getRange(first, 2, n, 2)
      .setHorizontalAlignment('center')
      .setFontWeight('bold');
    sh.setRowHeights(first, n, ROW_PX_);
    labelTasks_(sh, rows.blocks);
    SheetViewsLayout.frameBlocks(
      sh,
      { cols: COLS_, first: first, last: n + 1 },
      rows.blocks
    );
  }

  return { build };
})();
