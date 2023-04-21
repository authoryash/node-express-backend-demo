"use strict";
const { Types } = require("mongoose");
const { Service } = require("../../system/services/Service");
const { NotificationListSchema } = require("../models/index.models");

class NotificationService extends Service {
  async setNotification(data, arrayData) {
    let today = new Date().toLocaleDateString();
    const notificationData = await NotificationListSchema.findOneAndUpdate(
      {
        recieverId: data.recieverId,
        createdDate: today,
      },
      {
        $set: data,
        $push: { notificationData: arrayData },
      },
      { upsert: true, returnNewDocument: true }
    );
    return notificationData;
  }
  async getNotifications(recieverId) {
    try {
      const data = await NotificationListSchema.aggregate([
        {
          $match: {
            recieverId: Types.ObjectId(recieverId),
          },
        },
        {
          $project: {
            "notificationData.senderId": 1,
            "notificationData.senderRole": 1,
            "notificationData.senderUsername": 1,
            "notificationData.senderPic": 1,
            "notificationData.description": 1,
            "notificationData.notificationType": 1,
            "notificationData.createdAt": 1,
            _id: 1,
          },
        },
        {
          $unwind: {
            path: "$notificationData",
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                {
                  _id: "$_id",
                },
                "$notificationData",
              ],
            },
          },
        },
      ]);

      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
}

module.exports = { NotificationService };
