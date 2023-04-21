const { AuthService } = require("./../services/AuthService");
const { User } = require("./../models/User");
const MentorUser = require("./../models/MentorUser");
const autoBind = require("auto-bind");
const { Exception, Success } = require("../utils/httpHandlers");
const { isEmpty } = require("lodash");
const { encryption } = require("../lib/cipher");
const { sendOTPService, verifyOTPService } = require("../lib/twilioOTP");
const {
  authTokenFields,
  USER_REG_FAILED,
} = require("../constants/index.constants");
const authService = new AuthService(User, MentorUser);

class AuthController {
  constructor(service) {
    this.service = service;
    autoBind(this);
  }

  async login(req, res) {
    const {
      regType = "",
      phoneNumber = "",
      socialRegId = "",
      role = "",
      FCMToken = "",
    } = req.body;
    try {
      const user = await this.service.userIsEitherMentorOrUser(
        regType === "phone" ? { phoneNumber } : { socialRegId }
      );
      if (isEmpty(user)) return Exception(res, 404, "User doesn't exists");
      if (user.role !== role)
        return Exception(
          res,
          404,
          `User doesn't registered as ${role} but as ${user.role}`
        );
      let authTokenObject = {};
      authTokenFields.forEach((item) => (authTokenObject[item] = user[item]));
      let authToken = encryption(JSON.stringify(authTokenObject));
      const tokenSet = await this.service.setTokensInDB(
        user._id.toString(),
        authToken,
        FCMToken,
        user.role
      );
      if (!user.isRecommendationComplete && user.role !== "mentor") {
        const data = {
          ...((!user?.wellnessCategories ||
            !user?.wellnessCategories?.length) && {
            isWellnessCategoryEmpty: true,
          }),
          ...(!user.following && {
            isNotFollowingAnyone: true,
          }),
          _id: user._id,
          authToken,
        };
        return Success(res, 200, "Recommendation data not completed", data);
      }
      if (isEmpty(tokenSet))
        return Exception(res, 400, "Error in getting authentication tokens");
      return Success(res, 200, "User logged in successfully", {
        authToken,
      });
    } catch (error) {
      return Exception(res, 400, "Unexpected", error);
    }
  }

  /**
   * @swagger
   * /api/v1/auth/send-otp:
   *  post:
   *    summary: Send OTP for login via phone number verification
   *    tags: [Authentication]
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              phoneNumber:
   *                type: string
   *    responses:
   *      '404':
   *        description: User doesn't exists
   *      '200':
   *        description: OTP send successfully
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                phoneNumber:
   *                  type: string
   *      '400':
   *        description: Validation Errors or Unexpected Errors
   */
  async sendOTP(req, res) {
    const { phoneNumber = "" } = req.body;
    try {
      const user = await this.service.userIsEitherMentorOrUser({ phoneNumber });
      if (isEmpty(user)) return Exception(res, 400, "User doesn't exists");
      const result = await sendOTPService(phoneNumber, "sms");
      if (typeof result === "object") throw result;
      if (result)
        return Success(res, 200, "OTP send successfully", { phoneNumber });
      return Exception(res, 400, "Unexpected Error, otp sending failed");
    } catch (error) {
      let errorMsg = "";
      if (error.code === 60203)
        errorMsg = "Maximum attempt reached, kindly wait for at least 10 min";
      if ([60200, 60205].includes(error.code))
        errorMsg =
          "Unsupported Mobile Number, kindly check number or use another one";
      if (errorMsg) return Exception(res, 400, errorMsg);
      return Exception(res, 400, "Unexpected Error, otp sending failed", error);
    }
  }

  /**
   * @swagger
   * /api/v1/auth/verify-otp:
   *  post:
   *    summary: Verify OTP for login purpose
   *    tags: [Authentication]
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              phoneNumber:
   *                type: string
   *              otp:
   *                type: string
   *    responses:
   *      '404':
   *        description: User doesn't exists
   *      '400':
   *        description: Validation Errors or Unexpected Errors
   *      '200':
   *        description: User logged in successfully
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                authToken:
   *                  type: string
   *                refreshToken:
   *                  type: string
   *                user:
   *                  type: object
   */
  async verifyOTP(req, res) {
    const { phoneNumber = "", otp = "" } = req.body;
    try {
      const result = await verifyOTPService(phoneNumber, otp);
      if (typeof result === "object") throw result;
      if (result)
        return Success(res, 200, "OTP verified successfully", { phoneNumber });
      if (!result) return Exception(res, 400, "Invalid OTP, Please try again");
      return Exception(res, 400, "Unexpected Error, otp verification failed");
    } catch (error) {
      let errorMsg = "";
      if (error.code === 60202)
        errorMsg =
          "Maximum attempts to verify otp has been reached, kindly wait for at least 10 min";
      if (error.code === 20404)
        errorMsg = `OTP already used for verify or OTP was not send to given mobile number`;
      if (errorMsg) return Exception(res, 400, errorMsg);
      return Exception(
        res,
        400,
        "Unexpected Error, otp verification failed",
        error
      );
    }
  }

  /**
   * @swagger
   * /api/v1/auth/register:
   *  post:
   *    summary: Store user details in database and register user
   *    tags: [Authentication]
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              email:
   *                type: string
   *              name:
   *                type: string
   *              userName:
   *                type: string
   *              phoneNumber:
   *                type: string
   *              role:
   *                type: string
   *                enum: [Member, Mentor]
   *              age:
   *                type: number
   *              gender:
   *                type: string
   *                enum: [Male, Female, Other]
   *              regType:
   *                type: string
   *                enum: ["phone", "google", "apple"]
   *              socialRegId:
   *                type: string
   *    responses:
   *      '403':
   *        description: User with given one or more details which required to be unique may already exists on database
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 403
   *                Message:
   *                  type: string
   *                errors:
   *                  type: string
   *                  default: ""
   *      '200':
   *        description: In case user is successfully registered and stored in database
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 200
   *                Message:
   *                  type: string
   *                  default: User registered successfully
   *                Success:
   *                  type: boolean
   *                  default: true
   *                data:
   *                  type: object
   *                  properties:
   *                    userId:
   *                      type: string
   *      '400':
   *        description: In case of unexpected error or validation error for request data
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 400
   *                Message:
   *                  type: string
   *                error:
   *                  type: object
   */
  async register(req, res) {
    const {
      userName,
      email,
      phoneNumber,
      socialRegId = "",
      regType = "",
    } = req.body;
    try {
      const user = await this.service.userIsEitherMentorOrUser({
        $or: [
          ...(regType !== "phone" ? [{ socialRegId }] : []),
          { email },
          { userName },
          { phoneNumber },
        ],
      });
      if (!isEmpty(user)) {
        let errorMsg = "";
        if (user.userName === userName) errorMsg = "Username already exists";
        if (user.email === email) errorMsg = "Email already registered";
        if (user.phoneNumber === phoneNumber)
          errorMsg = "Phone number already registered";
        if (regType !== "phone" && user.socialRegId === socialRegId)
          errorMsg = "This account has already been registered";
        if (errorMsg)
          return Exception(res, 403, `${USER_REG_FAILED}, ${errorMsg}`);
        return Exception(
          res,
          403,
          "User with either userName, email, phoneNumber or account already exists"
        );
      }
      const registeredUserData = await this.service.register(req.body);
      if (isEmpty(registeredUserData))
        return Exception(res, 400, `Unexpected Error! ${USER_REG_FAILED}`);
      return Success(res, 200, "User registered successfully", {
        userId: registeredUserData._id,
      });
    } catch (error) {
      return Exception(res, 400, `Unexpected Error! ${USER_REG_FAILED}`, error);
    }
  }

  async logout(req, res, next) {
    try {
      const response = await this.service.logout(req.token);

      await res.status(response.statusCode).json(response);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /api/v1/auth/check-unique-username:
   *  get:
   *    summary: Check whether given user name already exist in database or not
   *    tags: [Authentication]
   *    parameters:
   *      - in: query
   *        name: userName
   *        schema:
   *          type: string
   *        description: username which we need to check whether it's unique in database or not
   *    responses:
   *      '200':
   *        description: Username is unique
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 200
   *                Message:
   *                  type: string
   *                  default: Username is unique
   *                data:
   *                  type: string
   *                  default: ""
   *                Success:
   *                  type: boolean
   *                  default: true
   *      '403':
   *        description: Username is already used
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 403
   *                Message:
   *                  type: string
   *                  default: Username is already used
   *                errors:
   *                  type: string
   *                  default: ""
   *      '400':
   *        description: Validation error or Unexpected Error, in checking username uniqueness
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                Message:
   *                  type: string
   *                errors:
   *                  type: object
   */
  async checkUniqueUserName(req, res) {
    const { userName = "" } = req.query;
    try {
      const userNameExists = await this.service.userIsEitherMentorOrUser({
        userName,
      });
      if (isEmpty(userNameExists))
        return Success(res, 200, "Username is unique");
      return Exception(res, 403, "Username is already used");
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error, in checking username uniqueness",
        error
      );
    }
  }

  /**
   * @swagger
   * /api/v1/auth/check-phone-registered:
   *  post:
   *    summary: Check if phone number is already registered in database or not
   *    tags: [Authentication]
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              phoneNumber:
   *                type: string
   *    responses:
   *      '404':
   *        description: Phone number is not registered
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 404
   *                Message:
   *                  type: string
   *                  default: Phone number is not registered
   *                errors:
   *                  type: string
   *                  default: ""
   *      '400':
   *        description: Unexpected Error, in finding phone number is database or validation erros
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 200
   *                Message:
   *                  type: string
   *                errors:
   *                  type: object
   *      '200':
   *        description: Phone number exists
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 200
   *                Message:
   *                  type: string
   *                data:
   *                  type: string
   *                  default: ""
   *                Success:
   *                  type: boolean
   *                  default: true
   */
  async checkPhoneRegistered(req, res) {
    const { phoneNumber = "" } = req.body;
    try {
      const phoneNumberExists = await this.service.userIsEitherMentorOrUser({
        phoneNumber,
      });
      if (!phoneNumberExists)
        return Exception(res, 404, "Phone number is not registered");
      return Success(res, 200, "Phone number exists");
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error, in finding phone number in database",
        error
      );
    }
  }

  /**
   * @swagger
   * /api/v1/auth/check-social-already-registered:
   *  get:
   *    summary: Check if given unique social id of credential is already exists in database or not
   *    tags: [Authentication]
   *    parameters:
   *      - in: query
   *        name: socialRegId
   *        schema:
   *          type: string
   *        description: social registration id which we need to check whether it's unique in database or not
   *    responses:
   *      '400':
   *        description: Validation error or unexpected error
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                status:
   *                  type: number
   *                  default: 400
   *                Message:
   *                  type: string
   *                error:
   *                  type: object
   *      '200':
   *        description: Success fully getting result whether user exist in database or not
   *        content:
   *          application/json:
   *            schema:
   *              oneOf:
   *                - type: object
   *                  properties:
   *                    status:
   *                      type: number
   *                      default: 200
   *                    Message:
   *                      type: string
   *                      default: User does not exists in database
   *                    Success:
   *                      type: boolean
   *                      default: true
   *                    data:
   *                      type: object
   *                      properties:
   *                        userAlreadyExists:
   *                          type: boolean
   *                          default: false
   *                - type: object
   *                  properties:
   *                    status:
   *                      type: number
   *                      default: 200
   *                    Message:
   *                      type: string
   *                      default: User already exists in database
   *                    Success:
   *                      type: boolean
   *                      default: true
   *                    data:
   *                      type: object
   *                      properties:
   *                        userAlreadyExists:
   *                          type: boolean
   *                          default: true
   */
  async checkSocialAlreadyRegistered(req, res) {
    const { socialRegId = "" } = req.query;
    try {
      if (!socialRegId)
        return Exception(res, 400, "Social registration id not provided", {});
      const user = await this.service.userIsEitherMentorOrUser({ socialRegId });
      if (!user)
        return Success(res, 200, "User does not exists in database", {
          userAlreadyExists: false,
        });
      return Success(res, 200, "User already exists in database", {
        userAlreadyExists: true,
        role: user.role,
      });
    } catch (error) {
      return Exception(
        res,
        400,
        "Unexpected Error! Can't check user already exists or not"
      );
    }
  }
}

module.exports = new AuthController(authService);
