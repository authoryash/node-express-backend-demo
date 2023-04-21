module.exports = {
  ...require("./auth.middleware"),
  ...require("./commonValidators"),
  ...require("./user.middleware"),
  ...require("./mentors.middlewares"),
  ...require("./admin.middleware"),
};
