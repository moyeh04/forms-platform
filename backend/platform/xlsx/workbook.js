/**
 * A small .xlsx writer. Google Sheets cannot save a link to a file next to
 * the workbook, and the downloaded team list needs exactly that, so the
 * workbook is written here as the XML files Excel reads, zipped together.
 *
 * Each sheet of `xlsxBlob` is
 * `{ name, rows: [[cell]], merges: ['D2:D4'], heights: px, widths: [n] }`,
 * where `widths` gives the characters of each column. Without widths each
 * column fits its longest value, as Excel's autofit would; a file cannot ask
 * Excel to autofit, so Worksheet measures it here.
 *
 * Each cell is a string or a number, or `{ v, style, link }`. `style` is the
 * place in `styles`, counted from 1, of `{ fill, color, bold, underline,
 * align, rtl, wrap }`, where align is 'left', 'center' or 'right'. `link` is
 * a URL or a relative path. A sheet prints one page wide.
 */

var Workbook = (function () {
  /** The namespace of the list of the package's parts. */
  var NS_TYPES_ =
    'http://schemas.openxmlformats.org/package/2006/content-types';

  /** How the media type of each spreadsheet part starts. */
  var SPREADSHEET_TYPE_ =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.';

  /** The media type of a list of links. */
  var RELS_TYPE_ = 'application/vnd.openxmlformats-package.relationships+xml';

  /** The longest sheet name Excel accepts. */
  var MAX_SHEET_NAME_ = 31;

  /**
   * Writes the media type of one spreadsheet part.
   *
   * @param {string} name The path of the part, such as `/xl/styles.xml`.
   * @param {string} type The end of its media type, such as 'styles+xml'.
   * @return {string} The Override element.
   */
  function override_(name, type) {
    return Xml.element('Override', {
      PartName: name,
      ContentType: SPREADSHEET_TYPE_ + type
    });
  }

  /**
   * Writes the list of the package's parts and their media types.
   *
   * @param {!Array<!Object>} sheets The sheets.
   * @return {string} The XML of [Content_Types].xml.
   */
  function contentTypes_(sheets) {
    var parts = sheets.map(function (_s, i) {
      return override_(
        '/xl/worksheets/sheet' + (i + 1) + '.xml',
        'worksheet+xml'
      );
    });
    return (
      Xml.DECLARATION +
      Xml.element(
        'Types',
        { xmlns: NS_TYPES_ },
        Xml.element('Default', { Extension: 'rels', ContentType: RELS_TYPE_ }) +
          Xml.element('Default', {
            Extension: 'xml',
            ContentType: 'application/xml'
          }) +
          override_('/xl/workbook.xml', 'sheet.main+xml') +
          override_('/xl/styles.xml', 'styles+xml') +
          parts.join('')
      )
    );
  }

  /**
   * Writes the workbook part: the sheets by name.
   *
   * @param {!Array<!Object>} sheets The sheets.
   * @return {string} The XML of xl/workbook.xml.
   */
  function workbookPart_(sheets) {
    var items = sheets.map(function (s, i) {
      return Xml.element('sheet', {
        name: Xml.xmlText(String(s.name).slice(0, MAX_SHEET_NAME_)),
        sheetId: i + 1,
        'r:id': 'rId' + (i + 1)
      });
    });
    return (
      Xml.DECLARATION +
      Xml.element(
        'workbook',
        { xmlns: Xml.NS.main, 'xmlns:r': Xml.NS.rel },
        Xml.element('sheets', null, items.join(''))
      )
    );
  }

  /**
   * Writes the links of the workbook part: each sheet, then the styles.
   *
   * @param {!Array<!Object>} sheets The sheets.
   * @return {string} The XML of xl/_rels/workbook.xml.rels.
   */
  function workbookRels_(sheets) {
    var items = sheets.map(function (_s, i) {
      var target = 'worksheets/sheet' + (i + 1) + '.xml';
      return Xml.relationship(i + 1, 'worksheet', target);
    });
    items.push(Xml.relationship(sheets.length + 1, 'styles', 'styles.xml'));
    return Xml.relationships(items);
  }

  /**
   * Writes a workbook.
   *
   * @param {string} name The file name.
   * @param {!Array<!Object>} sheets The sheets.
   * @param {!Array<!Object>=} styles The styles the cells name.
   * @return {!Blob} The .xlsx file.
   */
  function xlsxBlob_(name, sheets, styles) {
    var files = [];
    /**
     * Adds a part to the package.
     *
     * @param {string} path Where it is in the package.
     * @param {string} text Its XML.
     */
    function add(path, text) {
      files.push(Utilities.newBlob(text, 'application/xml', path));
    }
    add('[Content_Types].xml', contentTypes_(sheets));
    add(
      '_rels/.rels',
      Xml.relationships([
        Xml.relationship(1, 'officeDocument', 'xl/workbook.xml')
      ])
    );
    add('xl/workbook.xml', workbookPart_(sheets));
    add('xl/_rels/workbook.xml.rels', workbookRels_(sheets));
    add('xl/styles.xml', StyleSheet.write(styles || []));
    sheets.forEach(function (s, i) {
      var out = Worksheet.write(s);
      var file = 'sheet' + (i + 1) + '.xml';
      add('xl/worksheets/' + file, out.xml);
      if (out.rels) add('xl/worksheets/_rels/' + file + '.rels', out.rels);
    });
    return Utilities.zip(files, name).setContentType(
      SPREADSHEET_TYPE_ + 'sheet'
    );
  }

  return { xlsxBlob: xlsxBlob_ };
})();
