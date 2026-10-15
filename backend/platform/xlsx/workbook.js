/**
 * A small .xlsx writer. Google Sheets cannot save a link to a file next to the workbook, and
 * the downloaded team list needs exactly that, so the workbook is written here as the XML
 * files Excel reads, zipped together.
 *
 * xlsxBlob_(name, sheets): each sheet is
 *   { name, rows: [[cell]], merges: ['D2:D4'], heights: px, widths: [characters per column] }
 * Without widths each column fits its longest value, as Excel's autofit would (a file cannot ask
 * Excel to autofit, so the width is measured here); see xlsxFitWidths_.
 * and each cell is a string or number, or { v, style, link } where style is one of `styles`
 * (fill, color, bold, underline, align: 'left'|'center'|'right', rtl, wrap) and link is a URL or a
 * relative path. A sheet prints one page wide.
 */

function xlsxStyles_(styles) {
  var fonts = ['<font><sz val="11"/><name val="Arial"/></font>'];
  var fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>'
  ];
  var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  styles.forEach(function (s) {
    fonts.push(
      '<font>' +
        (s.bold ? '<b/>' : '') +
        (s.underline ? '<u/>' : '') +
        '<sz val="11"/>' +
        (s.color ? '<color rgb="' + xlsxColor_(s.color) + '"/>' : '') +
        '<name val="Arial"/></font>'
    );
    var fillId = 0;
    if (s.fill) {
      fills.push(
        '<fill><patternFill patternType="solid"><fgColor rgb="' +
          xlsxColor_(s.fill) +
          '"/><bgColor indexed="64"/></patternFill></fill>'
      );
      fillId = fills.length - 1;
    }
    xfs.push(
      '<xf numFmtId="0" fontId="' +
        (fonts.length - 1) +
        '" fillId="' +
        fillId +
        '" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment horizontal="' +
        (s.align || 'left') +
        '" vertical="center"' +
        (s.wrap ? ' wrapText="1"' : '') +
        (s.rtl ? ' readingOrder="2"' : '') +
        '/></xf>'
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="' +
    fonts.length +
    '">' +
    fonts.join('') +
    '</fonts>' +
    '<fills count="' +
    fills.length +
    '">' +
    fills.join('') +
    '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFC9B58A"/></left><right style="thin"><color rgb="FFC9B58A"/></right><top style="thin"><color rgb="FFC9B58A"/></top><bottom style="thin"><color rgb="FFC9B58A"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' +
    xfs.length +
    '">' +
    xfs.join('') +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  );
}

var XLSX_MIN_WIDTH_ = 6;

var XLSX_MAX_WIDTH_ = 60;

/**
 * The width of each column from its longest line, in Excel's units (about one character).
 * Bold text and the padding of a cell add a little; a longer value wraps at the widest width.
 */
function xlsxFitWidths_(rows) {
  var widths = [];
  rows.forEach(function (row) {
    row.forEach(function (cell, c) {
      var o = cell != null && typeof cell === 'object' ? cell : { v: cell };
      var longest = String(o.v == null ? '' : o.v)
        .split('\n')
        .reduce(function (m, line) {
          return Math.max(m, line.length);
        }, 0);
      widths[c] = Math.max(
        widths[c] || XLSX_MIN_WIDTH_,
        Math.min(XLSX_MAX_WIDTH_, Math.ceil(longest * 1.15) + 3)
      );
    });
  });
  return widths;
}

function xlsxSheet_(sheet) {
  var links = [];
  var rows = sheet.rows
    .map(function (row, r) {
      var cells = row
        .map(function (cell, c) {
          if (cell == null || cell === '') return '';
          var o = typeof cell === 'object' ? cell : { v: cell };
          var ref = xlsxColumn_(c) + (r + 1);
          var s = o.style ? ' s="' + o.style + '"' : '';
          if (o.link) links.push({ ref: ref, target: o.link });
          if (o.v == null || o.v === '') return '<c r="' + ref + '"' + s + '/>';
          if (typeof o.v === 'number')
            return '<c r="' + ref + '"' + s + '><v>' + o.v + '</v></c>';
          return (
            '<c r="' +
            ref +
            '"' +
            s +
            ' t="inlineStr"><is><t xml:space="preserve">' +
            xmlText_(o.v) +
            '</t></is></c>'
          );
        })
        .join('');
      return (
        '<row r="' +
        (r + 1) +
        '"' +
        (sheet.heights ? ' ht="' + sheet.heights + '" customHeight="1"' : '') +
        '>' +
        cells +
        '</row>'
      );
    })
    .join('');
  var cols = (sheet.widths || xlsxFitWidths_(sheet.rows))
    .map(function (w, i) {
      return (
        '<col min="' +
        (i + 1) +
        '" max="' +
        (i + 1) +
        '" width="' +
        w +
        '" customWidth="1"/>'
      );
    })
    .join('');
  var merges = (sheet.merges || []).length
    ? '<mergeCells count="' +
      sheet.merges.length +
      '">' +
      sheet.merges
        .map(function (m) {
          return '<mergeCell ref="' + m + '"/>';
        })
        .join('') +
      '</mergeCells>'
    : '';
  var hyper = links.length
    ? '<hyperlinks>' +
      links
        .map(function (l, i) {
          return '<hyperlink ref="' + l.ref + '" r:id="rId' + (i + 1) + '"/>';
        })
        .join('') +
      '</hyperlinks>'
    : '';
  var xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? '<cols>' + cols + '</cols>' : '') +
    '<sheetData>' +
    rows +
    '</sheetData>' +
    merges +
    hyper +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>';
  var rels = links.length
    ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      links
        .map(function (l, i) {
          return (
            '<Relationship Id="rId' +
            (i + 1) +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' +
            xmlText_(l.target) +
            '" TargetMode="External"/>'
          );
        })
        .join('') +
      '</Relationships>'
    : '';
  return { xml: xml, rels: rels };
}

function xlsxBlob_(name, sheets, styles) {
  var files = [];
  var add = function (path, text) {
    files.push(Utilities.newBlob(text, 'application/xml', path));
  };
  add(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets
        .map(function (s, i) {
          return (
            '<Override PartName="/xl/worksheets/sheet' +
            (i + 1) +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          );
        })
        .join('') +
      '</Types>'
  );
  add(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  );
  add(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets
        .map(function (s, i) {
          return (
            '<sheet name="' +
            xmlText_(String(s.name).slice(0, 31)) +
            '" sheetId="' +
            (i + 1) +
            '" r:id="rId' +
            (i + 1) +
            '"/>'
          );
        })
        .join('') +
      '</sheets></workbook>'
  );
  add(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets
        .map(function (s, i) {
          return (
            '<Relationship Id="rId' +
            (i + 1) +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
            (i + 1) +
            '.xml"/>'
          );
        })
        .join('') +
      '<Relationship Id="rId' +
      (sheets.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  );
  add('xl/styles.xml', xlsxStyles_(styles || []));
  sheets.forEach(function (s, i) {
    var out = xlsxSheet_(s);
    add('xl/worksheets/sheet' + (i + 1) + '.xml', out.xml);
    if (out.rels)
      add('xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', out.rels);
  });
  return Utilities.zip(files, name).setContentType(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
