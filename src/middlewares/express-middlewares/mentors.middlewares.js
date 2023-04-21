const { check } = require("express-validator");
const { keyToName } = require("../../helpers/string-conversions");
const {
  NotEmptyStringMiddleWare,
  RequestValidator,
} = require("./commonValidators");
const { ObjectIdValidator } = require("./user.middleware");

const QuestionNumberValidator = check("courseQuestions.*.questionNumber")
  .notEmpty()
  .withMessage(`${keyToName("questionNumber")} should be not empty`)
  .bail()
  .isInt()
  .withMessage(`${keyToName("questionNumber")} should be number`);

const QuestionValidator = check("courseQuestions.*.question")
  .isString()
  .withMessage("Question should be string")
  .bail()
  .notEmpty()
  .withMessage("Question should not be empty");

const BooleanValidator = (key) =>
  check(key)
    .isBoolean({ strict: true })
    .withMessage(`${keyToName(key)} must be a boolean value`);

const MentorMiddleWares = {
  DeleteLessonMiddlewares: [
    NotEmptyStringMiddleWare("courseId", "lessonId"),
    RequestValidator,
  ],
  AddBadgeToCourseValidator: [
    NotEmptyStringMiddleWare(
      "badgeName",
      "badgeDescription"
      // "badgeTriggerId",
      // "badgeCreatorId",
      // "badgeCourseId"
    ),
    ObjectIdValidator("badgeTriggerId", "badgeCourseId"),
    RequestValidator,
  ],
  EditCourseBadgeValidator: [
    ObjectIdValidator("badgeCourseId", "badgeId", "badgeTriggerId"),
    NotEmptyStringMiddleWare("badgeName", "badgeDescription"),
    RequestValidator,
  ],
  DeleteCourseBadgeValidator: [
    ObjectIdValidator("courseId", "badgeId"),
    RequestValidator,
  ],
  AddQuestionToCourseValidator: [
    NotEmptyStringMiddleWare("courseId"),
    QuestionNumberValidator,
    QuestionValidator,
    RequestValidator,
  ],
  UserCourseRateDataValidator: [
    NotEmptyStringMiddleWare("courseId"),
    BooleanValidator("ratingAllowed"),
    RequestValidator,
  ],
  SendCourseForApprovalValidator: [
    NotEmptyStringMiddleWare("courseId"),
    RequestValidator,
  ],
  GetLessonDetailsDataValidator: [
    NotEmptyStringMiddleWare("courseId", "lessonId"),
    RequestValidator,
  ],
};

module.exports = MentorMiddleWares;
