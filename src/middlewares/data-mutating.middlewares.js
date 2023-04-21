const mongoose = require("mongoose");
const { TokenValidatorHelperFunction } = require("./tokenValidator");

const AddUserDetailsFromAuthToken = (req, res, next) => {
  TokenValidatorHelperFunction(req, res, () => {
    req.query = { ...req.body };
    next();
  });
};

const AddId = (key) => {
  return (req, _res, next) => {
    const id = new mongoose.Types.ObjectId();
    req.query[key] = id.toString();
    next();
  };
};

const DataMutationMiddleWares = {
  AddCourseId: AddId("courseId"),
  AddLessonDataValidator: [AddUserDetailsFromAuthToken, AddId("lessonId")],
  AddBadgeId: AddId("badgeId"),
  AddProductId: AddId("productId")
};

module.exports = { ...DataMutationMiddleWares, AddUserDetailsFromAuthToken };
