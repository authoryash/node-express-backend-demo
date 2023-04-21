const StringConversionFunctions = {
  keyToName: (key) =>
    key[0].toUpperCase() +
    key.substring(1).replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`),
};

module.exports = StringConversionFunctions;
