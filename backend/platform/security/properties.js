/** Script properties, including the secret pepper of every hash. */

var Properties = (function () {
  /**
   * Reads a script property.
   *
   * @param {string} k Its name, one of `Constants.PROPS`.
   * @return {?string} Its value, or null when it is not set.
   */
  function getProp(k) {
    return PropertiesService.getScriptProperties().getProperty(k);
  }

  /**
   * Writes a script property.
   *
   * @param {string} k Its name, one of `Constants.PROPS`.
   * @param {string} v Its value.
   */
  function setProp(k, v) {
    PropertiesService.getScriptProperties().setProperty(k, v);
  }

  /**
   * Gives the private random value that salts every stored hash, and makes
   * it the first time.
   *
   * @return {string} The pepper.
   */
  function pepper() {
    var p = getProp(Constants.PROPS.PEPPER);
    if (!p) {
      p = Crypto.uuid() + Crypto.uuid();
      setProp(Constants.PROPS.PEPPER, p);
    }
    return p;
  }

  return { pepper, setProp, getProp };
})();
