/** Ids, random digits, SHA-256 and the sealing of short digit strings. */

var Crypto = (function () {
function uuid() {
  return Utilities.getUuid();
}

function shortId(prefix) {
  return prefix + uuid().replace(/-/g, '').slice(0, 8);
}

function sha256Hex(s) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s)
  );
  return bytes
    .map(function (b) {
      return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
    })
    .join('');
}

function randomDigits(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Shifts each digit of `key` by the matching hex digit of `pad`. Client keys use it too. */
function sealDigits_(pad, key) {
  return (
    'S' +
    String(key)
      .split('')
      .map(function (d, i) {
        return String((parseInt(d, 10) + parseInt(pad.charAt(i), 16)) % 10);
      })
      .join('')
  );
}

function unsealDigits_(pad, seal, length) {
  var s = String(seal || '');
  if (!new RegExp('^S\\d{' + length + '}$').test(s)) return '';
  return s
    .slice(1)
    .split('')
    .map(function (d, i) {
      return String(
        (((parseInt(d, 10) - parseInt(pad.charAt(i), 16)) % 10) + 10) % 10
      );
    })
    .join('');
}

return { uuid, sha256Hex, shortId, unsealDigits: unsealDigits_, sealDigits: sealDigits_, randomDigits };
})();
