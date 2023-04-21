"use strict";
const {
  checkPhoneRegistered,
  login,
  checkUniqueUserName,
  register,
  checkSocialAlreadyRegistered,
  sendOTP,
  verifyOTP,
} = require("../../controllers/AuthController");
const {
  UserNameValidator,
  RegistrationValidator,
  PhoneNumberValidatorWithErrors,
  LoginValidator,
  SendOTPValidator,
  VerifyOTPValidator,
} = require("../../middlewares/index.middleware");
const express = require("express"),
  router = express.Router();

router.post(
  "/check-phone-registered",
  PhoneNumberValidatorWithErrors,
  checkPhoneRegistered
);
router.post("/send-otp", SendOTPValidator, sendOTP);
router.post("/verify-otp", VerifyOTPValidator, verifyOTP);
router.post("/login", LoginValidator, login);
router.get("/check-unique-username", UserNameValidator, checkUniqueUserName);
router.post("/register", RegistrationValidator, register);
router.get("/check-social-already-registered", checkSocialAlreadyRegistered);

module.exports = router;
