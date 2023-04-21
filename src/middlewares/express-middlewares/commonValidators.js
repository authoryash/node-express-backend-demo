const { validationResult, check } = require("express-validator");
const { userRoleType } = require("../../constants/index.constants");
const { keyToName } = require("../../helpers/index.helper");
const { Exception } = require("../../utils/httpHandlers");

function RequestValidator(request, response, next) {
  const errors = validationResult(request);
  const errorList = {};

  errors.errors.forEach((error) => {
    if (error.nestedErrors) {
      error.nestedErrors.forEach((nestedError) => {
        if (nestedError.value !== undefined)
          errorList[nestedError.param] = nestedError.msg;
      });
    } else {
      errorList[error.param] = error.msg;
    }
  });

  if (!errors.isEmpty()) {
    return Exception(response, 400, Object.values(errorList)[0], errorList);
  }

  next();
}

const idNaming = {
  _id: "User Id",
  influencerId: "Influencer Id",
};

const RoleValidator = (roleField = "role") =>
  check(roleField)
    .notEmpty({ ignore_whitespace: true })
    .withMessage("Role can not be empty")
    .toLowerCase()
    .isIn(userRoleType)
    .withMessage("Role must be either member or mentor");

const IdValidator = (idType = "_id") =>
  check(idType)
    .isString()
    .withMessage("Id must be a string")
    .notEmpty({ ignore_whitespace: true })
    .withMessage(`${idNaming[idType] ?? "Id"} can not be empty`);

const NotEmptyStringMiddleWare = (...keysArray) =>
  keysArray.map((key) =>
    check(key)
      .isString()
      .withMessage(`${keyToName(key)} must be string`)
      .bail()
      .notEmpty({ ignore_whitespace: true })
      .withMessage(`${keyToName(key)} can not be empty`)
      .bail()
  );

module.exports = {
  RequestValidator,
  RoleValidator,
  IdValidator,
  NotEmptyStringMiddleWare,
};
