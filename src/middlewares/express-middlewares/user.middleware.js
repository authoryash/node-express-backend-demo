const { query, body, check } = require("express-validator");
const { keyToName } = require("../../helpers/index.helper");
const { Types } = require("mongoose");
const {
  RequestValidator,
  RoleValidator,
  IdValidator,
} = require("./commonValidators");

const NotEmptyIdsArrayMiddleWare = (key) =>
  body(key)
    .if(body(key).exists())
    .isArray({ min: 1 })
    .withMessage(`${keyToName(key)} must be array with atleast 1 item`)
    .bail()
    .custom((value) => {
      const result = value.some((item) => item.length !== 24);
      if (result) throw "Invalid value of id is passed to array";
      return true;
    });

const ObjectIdValidator = (...keysArray) =>
  keysArray.map((key) =>
    check(key)
      .custom((value) => {
        if (typeof value !== "object") value = Types.ObjectId(value);
        return value;
      })
      .withMessage(`${keyToName(key)} is not valid`)
  );

const TokenValidRoleMiddleWare = (role) =>
  body("role")
    .equals(role)
    .withMessage(`Only ${role} can access this functionality`);

const UserMiddlewares = {
  RecommendationValidator: [
    query("categoryIds")
      .isString()
      .notEmpty({ ignore_whitespace: true })
      .withMessage("User must select categories"),
    RequestValidator,
  ],
  FollowUserValidator: [
    RoleValidator("influencerRole"),
    RoleValidator(),
    IdValidator(),
    IdValidator("influencerId"),
    RequestValidator,
  ],
  GetCourseDetailsDataValidator: [
    ObjectIdValidator("courseId"),
    RequestValidator,
  ],
  GetCourseProgressDataValidator: [
    ObjectIdValidator("courseId", "lessonId"),
    RequestValidator,
  ],
  DiscoverAPIsValidator: (key, role) => [
    NotEmptyIdsArrayMiddleWare(key),
    TokenValidRoleMiddleWare(role),
    RequestValidator,
  ],
  FeedPostValidator: (key) => [
    NotEmptyIdsArrayMiddleWare(key),
    RoleValidator("getPostsOf"),
    RequestValidator,
  ],
  SearchUserValidator: [
    body("alreadyFetchedUsersId")
      .if(body("alreadyFetchedUsersId").exists())
      .isArray({ min: 0 })
      .withMessage(`${keyToName("alreadyFetchedUsersId")} is not an array`)
      .custom((value, { req }) => {
        const idArray = value.map((item) => Types.ObjectId(item));
        req.body.alreadyFetchedUsersIdObjects = idArray;
        return true;
      })
      .withMessage("Array contains invalid id"),
    RequestValidator,
  ],
};

module.exports = { ...UserMiddlewares, ObjectIdValidator };
