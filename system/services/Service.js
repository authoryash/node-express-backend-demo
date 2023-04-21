"use strict";
const autoBind = require("auto-bind");
const { HttpResponse } = require("../helpers/HttpResponse");
const { isEmpty } = require("lodash");
const { admin } = require("../../config/firebase-config");

class Service {
  /**
   * Base Service Layer
   * @author Hitesh Solanki
   * @param model
   */
  constructor(model) {
    this.model = model;
    autoBind(this);
  }

  async get(id) {
    const item = await this.model.findById(id);

    if (!item) {
      // const error = new Error("Item not found");

      // error.statusCode = 404;
      // throw error;
      return null;
    }

    return new HttpResponse(item);
  }

  async insert(data) {
    console.log({ insert: data, model: this.model })
    const item = await this.model.create(data);
    return isEmpty(item) ? null : item;
  }

  async update(id, data) {
    const item = await this.model.findByIdAndUpdate(id, data, { new: true });
    return new HttpResponse(item);
  }

  async delete(id) {
    const item = await this.model.findByIdAndDelete(id);

    if (!item) {
      const error = new Error("Item not found");
      error.statusCode = 404;
      throw error;
    } else {
      return new HttpResponse(item, { deleted: true });
    }
  }

  async findInDB(findParam) {
    const user = await this.model.findOne(findParam);
    return user;
  }

  async setTokensInDB(_id, authToken, FCMToken) {
    return this.model.findOneAndUpdate(
      { _id },
      { authToken, FCMToken },
      { new: true }
    );
  }
  async sendNotification({ registrationToken, message }) {
    try {
      const notification_options = {
        priority: "high",
        timeToLive: 60 * 60 * 24,
      };

      const options = notification_options;

      let data = await admin
        .messaging()
        .sendToDevice(registrationToken, message, options);

      return data;
    } catch (error) {
      return error;
    }
  }
}

module.exports = { Service };
