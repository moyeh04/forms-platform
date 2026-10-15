/**
 * The bookings of a booking form on the instructor page: a block for each
 * day, with its bookings in a table.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var h = App.ui.h;

  /**
   * Gathers the rows by day, in the order the days first appear.
   *
   * @param {!Array<!Object>} rows The rows.
   * @return {!Array<!Object>} Each day with its label, date and rows.
   */
  function byDay(rows) {
    var groups = [];
    rows.forEach(function (r) {
      var g = groups.filter(function (x) {
        return x.id === r.dayId;
      })[0];
      if (!g) {
        g = { id: r.dayId, label: r.dayLabel, date: r.date, rows: [] };
        groups.push(g);
      }
      g.rows.push(r);
    });
    return groups;
  }

  /**
   * Draws the block of a day.
   *
   * @param {!Array<!Object>} cols The columns.
   * @param {!Object} g The day.
   * @param {number} i Where it is on the page.
   * @return {!Element} The block.
   */
  function dayBlock(cols, g, i) {
    return h(
      'section',
      {
        class: 'block single ' + (i % 2 ? 'tint-b' : 'tint-a'),
        dataset: { day: g.id }
      },
      h(
        'div',
        { class: 'day-head' },
        h('span', null, g.label + (g.date ? ' (' + g.date + ')' : '')),
        h('span', null, g.rows.length + ' booked')
      ),
      h(
        'div',
        { class: 'scroll-x' },
        h(
          'table',
          { class: 'mini' },
          V.tableHead(cols),
          h(
            'tbody',
            null,
            g.rows.map(function (r) {
              return h(
                'tr',
                null,
                cols.map(function (c) {
                  var td = V.cell(c.id, r);
                  td.dataset.label = c.label;
                  return td;
                })
              );
            })
          )
        )
      )
    );
  }

  /**
   * Draws the bookings that hold the search.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The bookings.
   */
  V.bookings = function (d) {
    var rows = d.rows.filter(V.matches);
    if (!rows.length) {
      return h(
        'div',
        { class: 'empty' },
        S.mode === 'today' ? 'No bookings for today.' : 'No bookings to show.'
      );
    }
    return h('div', null, byDay(rows).map(dayBlock.bind(null, d.columns)));
  };
})(window.App);
