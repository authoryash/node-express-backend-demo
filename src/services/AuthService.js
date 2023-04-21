"use strict";
const { UserService } = require("./UserService");
const MentorUserService = require("./MentorUserService");
const autoBind = require("auto-bind");
const { isEmpty } = require("lodash");

class AuthService {
  constructor(userModel) {
    this.userService = new UserService(userModel);
    this.mentorUserService = MentorUserService;
    autoBind(this);
  }

  async register(data) {
    try {
      let service = "";
      let role = data.role;
      if (role === "member") service = this.userService;
      if (role === "mentor") service = this.mentorUserService;
      if (service) {
        return await service.insert(data);
      }
    } catch (error) {
      console.log("error", error);
      return false;
    }
  }

  async setTokensInDB(_id, authToken, FCMToken, role) {
    if (role === "member")
      return this.userService.setTokensInDB(_id, authToken, FCMToken);
    if (role === "mentor")
      return this.mentorUserService.setTokensInDB(_id, authToken, FCMToken);
    return null;
  }

  async userIsEitherMentorOrUser(findParam) {
    let user = await this.userService.findInDB(findParam);
    if (!isEmpty(user)) return user;
    user = await this.mentorUserService.findInDB(findParam);
    return user;
  }
}

module.exports = { AuthService };
