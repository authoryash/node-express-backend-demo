const { check, oneOf } = require("express-validator");
const {
  regType,
  genderType,
  phoneNumberRegex,
} = require("../../constants/index.constants");
const { RequestValidator, RoleValidator } = require("./commonValidators");

const PhoneNumberValidator = check("phoneNumber")
  .isString()
  .notEmpty({ ignore_whitespace: true })
  .withMessage("Mobile Number can not be empty")
  .matches(phoneNumberRegex)
  .withMessage(
    "Mobile number must contain number with + sign and country code"
  );

const NameValidator = check("name")
  .isString()
  .withMessage("Full Name should be a string")
  .notEmpty({ ignore_whitespace: true })
  .trim()
  .withMessage("Full Name can not be empty")
  .isLength({ min: 1, max: 100 })
  .withMessage("Name should contain maximum 100 characters");

const EmailValidator = check("email")
  .notEmpty({ ignore_whitespace: true })
  .withMessage("Email can not be empty")
  .isEmail()
  .withMessage("Email is not in proper format");

const FCMTokenValidator = check("FCMToken")
  .notEmpty({ ignore_whitespace: true })
  .withMessage("FCMToken can not be empty");

const UserNameValidator = [
  check("userName")
    .isString()
    .trim()
    .isLength({ min: 6 })
    .withMessage("Username must have at least 6 characters"),
  RequestValidator,
];

const GenderValidator = check("gender")
  .notEmpty({ ignore_whitespace: true })
  .withMessage("Gender can not be empty")
  .isIn(genderType)
  .withMessage("Gender must be from given options");

const AgeValidator = check("age")
  .isInt({ min: 1 })
  .withMessage("Age Must be a number with minimum 1 years");

const RegistrationTypeValidator = check("regType")
  .toLowerCase()
  .isIn(regType)
  .withMessage("Registration must be done using given options only");

const SocialRegIdValidator = check("socialRegId")
  .if(check("regType").isIn(regType.filter((item) => item !== "phone")))
  .isString()
  .notEmpty({ ignore_whitespace: true })
  .withMessage("Social registration id can not be empty");

const PhoneNumberValidatorWithErrors = [PhoneNumberValidator, RequestValidator];

const RegistrationValidator = [
  NameValidator,
  FCMTokenValidator,
  EmailValidator,
  UserNameValidator,
  PhoneNumberValidator,
  GenderValidator,
  AgeValidator,
  RoleValidator(),
  RegistrationTypeValidator,
  SocialRegIdValidator,
  RequestValidator,
];

const LoginValidator = [
  RegistrationTypeValidator,
  FCMTokenValidator,
  RoleValidator(),
  oneOf([PhoneNumberValidator, SocialRegIdValidator]),
  RequestValidator,
];

const SendOTPValidator = [PhoneNumberValidator, RequestValidator];

const OTPValidator = check("otp")
  .isString()
  .notEmpty({ ignore_whitespace: true })
  .withMessage("OTP can not be empty")
  .isLength({ min: 6, max: 6 })
  .withMessage("OTP must be of 6 digits");

const VerifyOTPValidator = [
  PhoneNumberValidator,
  OTPValidator,
  RequestValidator,
];

module.exports = {
  UserNameValidator,
  RegistrationValidator,
  PhoneNumberValidatorWithErrors,
  LoginValidator,
  SendOTPValidator,
  VerifyOTPValidator,
};
