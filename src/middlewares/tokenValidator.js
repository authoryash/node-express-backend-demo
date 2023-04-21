const { userRoles } = require("../constants/index.constants");
const { decryption } = require("../lib/cipher");
const MentorUser = require("../models/MentorUser");
const { User } = require("../models/User");
const { Exception } = require("../utils/httpHandlers");

const TokenValidatorHelperFunction = async (req, res, callBack = () => {}) => {
  try {
    const authToken = req.headers.authorization?.split(" ")[1];
    if (!authToken) throw "No authToken provided!";
    let decodedAuthToken = decryption(authToken);
    decodedAuthToken = JSON.parse(decodedAuthToken);
    if (!decodedAuthToken?.role || !userRoles.includes(decodedAuthToken?.role))
      throw "User must be from given roles";
    let UserSchema = null;
    if (decodedAuthToken?.role === "member") UserSchema = User;
    if (decodedAuthToken?.role === "mentor") UserSchema = MentorUser;
    if (!UserSchema) throw "User must be from given roles";
    const findUser = await UserSchema.findOne({
      authToken,
      _id: decodedAuthToken._id,
    });
    if (!findUser) throw "Unauthorized! Please login again";
    else {
      req.body._id = decodedAuthToken._id;
      req.body.phoneNumber = decodedAuthToken.phoneNumber;
      req.body.email = decodedAuthToken.email;
      req.body.role = decodedAuthToken.role;
      callBack();
    }
  } catch (error) {
    let errorMsg;
    if (typeof error === "string") errorMsg = error;
    return Exception(
      res,
      401,
      errorMsg ?? "Unauthorized!",
      errorMsg ? {} : error
    );
  }
};

const TokenValidator = async (req, res, next) => {
  await TokenValidatorHelperFunction(req, res, next);
};

module.exports = { TokenValidator, TokenValidatorHelperFunction };
