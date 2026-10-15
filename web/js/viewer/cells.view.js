/**
 * The cells of the instructor page tables: Arabic text kept in its own
 * direction, and each column drawn the way its values read best.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var h = App.ui.h;

  /** The columns written in a fixed-width font. */
  var MONO = ['code', 'phone', 'time'];

  /**
   * Wraps text that may be Arabic so it keeps its own direction.
   *
   * @param {string} text The text.
   * @return {!Element} The text.
   */
  V.bdi = function (text) {
    return h('bdi', { lang: 'ar' }, text || '');
  };

  /**
   * Draws the cell of a column of a row.
   *
   * @param {string} col The column.
   * @param {!Object} row The row.
   * @return {!Element} The cell.
   */
  V.cell = function (col, row) {
    var v = row[col];
    if (col === 'name') return h('td', { class: 'nm' }, V.bdi(v));
    if (MONO.indexOf(col) !== -1) return h('td', { class: 'mono' }, v);
    if (col === 'link') {
      return h(
        'td',
        null,
        v ? h('a', { href: v, target: '_blank', rel: 'noopener' }, 'Open') : ''
      );
    }
    if (col === 'members') return h('td', null, v || '');
    return h('td', null, v === undefined ? '' : String(v));
  };

  /**
   * Draws the head of a table: one cell per column.
   *
   * @param {!Array<{label: string}>} cols The columns.
   * @return {!Element} The head.
   */
  V.tableHead = function (cols) {
    return h(
      'thead',
      null,
      h(
        'tr',
        null,
        cols.map(function (c) {
          return h('th', null, c.label);
        })
      )
    );
  };
})(window.App);
