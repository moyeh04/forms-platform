/**
 * The XML pieces of an Excel file: escaped text, column letters and colours.
 */

function xmlText_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "A", "B", ... "AA" for a 0-based column. */
function xlsxColumn_(i) {
  var s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function xlsxColor_(hex) {
  return (
    'FF' +
    String(hex || '#000000')
      .replace('#', '')
      .toUpperCase()
  );
}
