const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VERIFY_SERVICE_SID } =
  process.env;
const client = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

class TwilioOtpServices {
  sendOTPService(to, channel) {
    return client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({ to, channel })
      .then(
        () => true,
        (rejection) => {
          return rejection;
        }
      )
      .catch((error) => error);
  }

  async verifyOTPService(to, code) {
    try {
      const verification = await client.verify.v2
        .services(VERIFY_SERVICE_SID)
        .verificationChecks.create({ to, code });
      return verification.valid;
    } catch (error) {
      return error;
    }
  }
}

module.exports = new TwilioOtpServices();
