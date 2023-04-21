const DateConversionFunctions = {
  addDaysToDate: (date, days) => new Date(date.setDate(date.getDate() + days)),
};

module.exports = DateConversionFunctions;
