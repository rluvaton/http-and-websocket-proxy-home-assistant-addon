/**
 * Deep freeze object
 * @param {T} object
 * @param {any} frozenObjectsSet
 * @return {T}
 * @template T
 */
function deepFreeze(object, frozenObjectsSet = new WeakSet()) {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  // Freeze properties before freezing self

  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === "object" && !frozenObjectsSet.has(value)) {
      // To avoid cycle loop
      frozenObjectsSet.add(value);
      deepFreeze(value, frozenObjectsSet);
    }
  }

  return Object.freeze(object);
}

module.exports = {
  deepFreeze
}
