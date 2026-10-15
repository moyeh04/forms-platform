/** Script properties, including the secret pepper of every hash. */

function getProp(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function setProp(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, v);
}

/** A private random value that salts every stored hash. Created once. */
function pepper() {
  var p = getProp('PEPPER');
  if (!p) {
    p = uuid() + uuid();
    setProp('PEPPER', p);
  }
  return p;
}
