const { check } = require("express-validator");
const {
  RequestValidator,
  NotEmptyStringMiddleWare,
} = require("./commonValidators");

const AdminMiddleWares = {
  AddBadgeTriggerValidator: [
    NotEmptyStringMiddleWare("triggerName", "triggerCondition"),
    check("weightage").isNumeric().withMessage("Weightage should be a number"),
    RequestValidator,
  ],
};

module.exports = AdminMiddleWares;
