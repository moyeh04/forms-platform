/**
 * The style sheet of an Excel file: a plain cell format, then one for each
 * style a workbook names.
 */

var StyleSheet = (function () {
  /** The font size of every cell, in points. */
  var FONT_SIZE_ = 11;

  /** The colour index Excel reads as "automatic". */
  var AUTO_COLOR_ = 64;

  /** The reading order of right-to-left text. */
  var RIGHT_TO_LEFT_ = 2;

  /** The border every styled cell gets, the second in the list. */
  var GRID_BORDER_ = 1;

  /**
   * Writes a font.
   *
   * @param {!Object} s The style: bold, underline and color are used.
   * @return {string} The font element.
   */
  function font_(s) {
    var color = s.color
      ? Xml.element('color', { rgb: Xml.xlsxColor(s.color) })
      : '';
    return Xml.element(
      'font',
      null,
      (s.bold ? Xml.element('b') : '') +
        (s.underline ? Xml.element('u') : '') +
        Xml.element('sz', { val: FONT_SIZE_ }) +
        color +
        Xml.element('name', { val: SheetStyle.PALETTE.font })
    );
  }

  /**
   * Writes a fill.
   *
   * @param {string} pattern The pattern: 'none', 'gray125' or 'solid'.
   * @param {string=} color The colour of a solid fill.
   * @return {string} The fill element.
   */
  function fill_(pattern, color) {
    var body = color
      ? Xml.element('fgColor', { rgb: Xml.xlsxColor(color) }) +
        Xml.element('bgColor', { indexed: AUTO_COLOR_ })
      : undefined;
    return Xml.element(
      'fill',
      null,
      Xml.element('patternFill', { patternType: pattern }, body)
    );
  }

  /**
   * Writes a border: thin lines in a colour, or none.
   *
   * @param {string=} color The colour of the lines; none without it.
   * @return {string} The border element.
   */
  function border_(color) {
    var sides = ['left', 'right', 'top', 'bottom'].map(function (side) {
      if (!color) return Xml.element(side);
      return Xml.element(
        side,
        { style: 'thin' },
        Xml.element('color', { rgb: Xml.xlsxColor(color) })
      );
    });
    return Xml.element(
      'border',
      null,
      sides.join('') + Xml.element('diagonal')
    );
  }

  /**
   * Writes the cell format of a style.
   *
   * @param {!Object} s The style: align, wrap and rtl are used.
   * @param {number} fontId The place of its font.
   * @param {number} fillId The place of its fill.
   * @return {string} The xf element.
   */
  function cellFormat_(s, fontId, fillId) {
    var alignment = Xml.element('alignment', {
      horizontal: s.align || 'left',
      vertical: 'center',
      wrapText: s.wrap ? 1 : undefined,
      readingOrder: s.rtl ? RIGHT_TO_LEFT_ : undefined
    });
    return Xml.element(
      'xf',
      {
        numFmtId: 0,
        fontId: fontId,
        fillId: fillId,
        borderId: GRID_BORDER_,
        xfId: 0,
        applyFont: 1,
        applyFill: 1,
        applyBorder: 1,
        applyAlignment: 1
      },
      alignment
    );
  }

  /**
   * Writes the style sheet: the plain format first, then one for each style.
   *
   * @param {!Array<!Object>} styles The styles.
   * @return {string} The XML of styles.xml.
   */
  function styleSheet_(styles) {
    var plain = { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 };
    var fonts = [font_({})];
    var fills = [fill_('none'), fill_('gray125')];
    var xfs = [Xml.element('xf', Object.assign({}, plain, { xfId: 0 }))];
    styles.forEach(function (s) {
      fonts.push(font_(s));
      var fillId = 0;
      if (s.fill) {
        fills.push(fill_('solid', s.fill));
        fillId = fills.length - 1;
      }
      xfs.push(cellFormat_(s, fonts.length - 1, fillId));
    });
    var normal = { name: 'Normal', xfId: 0, builtinId: 0 };
    return (
      Xml.DECLARATION +
      Xml.element(
        'styleSheet',
        { xmlns: Xml.NS.main },
        Xml.counted('fonts', fonts) +
          Xml.counted('fills', fills) +
          Xml.counted('borders', [
            border_(),
            border_(SheetStyle.PALETTE.grid)
          ]) +
          Xml.counted('cellStyleXfs', [Xml.element('xf', plain)]) +
          Xml.counted('cellXfs', xfs) +
          Xml.counted('cellStyles', [Xml.element('cellStyle', normal)])
      )
    );
  }

  return { write: styleSheet_ };
})();
