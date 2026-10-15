/** Copying values and reading JSON text safely. */

function clone(o) {
  return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

function parseJson(text, fallback) {
  if (text === '' || text === null || text === undefined) return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}
