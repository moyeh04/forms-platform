/**
 * The XML pieces of an Excel file: elements, escaped text, column letters
 * and colours.
 */

var Xml = (function () {
  /** The first line of every XML file in the package. */
  var DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  /** The namespaces of the parts of an Excel file. */
  var NS = Object.freeze({
    main: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    rels: 'http://schemas.openxmlformats.org/package/2006/relationships'
  });

  /** The letters of Excel's column names. */
  var LETTERS_ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /** The first character code XML 1.0 allows without exception. */
  var FIRST_PRINTABLE_ = 0x20;

  /** The control characters XML 1.0 allows: tab, line feed, return. */
  var XML_WHITESPACE_ = '\t\n\r';

  /** The colour of a cell or font that names none. */
  var BLACK_ = '#000000';

  /** The alpha Excel puts before a colour: fully opaque. */
  var OPAQUE_ = 'FF';

  /**
   * Writes an element. Attribute values are written as given, so a value
   * that may hold `&`, `<` or `"` goes through `xmlText` first.
   *
   * @param {string} name The element name.
   * @param {?Object=} attrs The attributes in order; an undefined value is
   *     left out.
   * @param {*=} body The content; without it the element closes itself.
   * @return {string} The element.
   */
  function element(name, attrs, body) {
    var open = '<' + name;
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== undefined) open += ' ' + key + '="' + attrs[key] + '"';
    });
    if (body === undefined) return open + '/>';
    return open + '>' + body + '</' + name + '>';
  }

  /**
   * Writes a list element that states how many items it holds.
   *
   * @param {string} name The element name.
   * @param {!Array<string>} items The items.
   * @return {string} The element.
   */
  function counted(name, items) {
    return element(name, { count: items.length }, items.join(''));
  }

  /**
   * Writes a link from one part to another.
   *
   * @param {number} id Its number in the list.
   * @param {string} kind What it points at, such as 'worksheet'.
   * @param {string} target The part or the URL.
   * @param {boolean=} external True when the target is outside the package.
   * @return {string} The Relationship element.
   */
  function relationship(id, kind, target, external) {
    return element('Relationship', {
      Id: 'rId' + id,
      Type: NS.rel + '/' + kind,
      Target: target,
      TargetMode: external ? 'External' : undefined
    });
  }

  /**
   * Writes a list of links.
   *
   * @param {!Array<string>} items The Relationship elements.
   * @return {string} The XML of a .rels file.
   */
  function relationships(items) {
    return (
      DECLARATION + element('Relationships', { xmlns: NS.rels }, items.join(''))
    );
  }

  /**
   * Says whether XML 1.0 may hold a character.
   *
   * @param {string} ch The character.
   * @return {boolean} True unless it is a control character XML refuses.
   */
  function allowed_(ch) {
    return (
      ch.charCodeAt(0) >= FIRST_PRINTABLE_ || XML_WHITESPACE_.indexOf(ch) >= 0
    );
  }

  /**
   * Makes a value safe as XML text or an attribute value: drops the control
   * characters XML refuses and escapes the markup characters.
   *
   * @param {*} v The value; null and undefined are empty.
   * @return {string} The text.
   */
  function xmlText_(v) {
    return String(v == null ? '' : v)
      .split('')
      .filter(allowed_)
      .join('')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Names a column as Excel does.
   *
   * @param {number} i The column, from 0.
   * @return {string} "A", "B", ... "Z", "AA", ...
   */
  function xlsxColumn_(i) {
    var s = '';
    var n;
    for (n = i + 1; n > 0; n = Math.floor((n - 1) / LETTERS_.length)) {
      s = LETTERS_.charAt((n - 1) % LETTERS_.length) + s;
    }
    return s;
  }

  /**
   * Writes a colour as Excel reads it.
   *
   * @param {?string} hex A colour such as `#3A2A1A`; empty is black.
   * @return {string} The colour as alpha, red, green, blue: `FF3A2A1A`.
   */
  function xlsxColor_(hex) {
    var rgb = String(hex || BLACK_).replace('#', '');
    return OPAQUE_ + rgb.toUpperCase();
  }

  return {
    DECLARATION,
    NS,
    counted,
    element,
    relationship,
    relationships,
    xlsxColor: xlsxColor_,
    xlsxColumn: xlsxColumn_,
    xmlText: xmlText_
  };
})();
