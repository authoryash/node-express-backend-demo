const { Schema, model } = require("mongoose");
const notificationDataschema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
    },
    senderUsername: {
      type: String,
      required: true,
    },
    senderPic: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    notificationType: {
      type: String,
      required: true,
    },
    notificationSent: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);
const NotificationListSchema = new Schema(
  {
    recieverId: {
      type: Schema.Types.ObjectId,
    },
    recieverRole: {
      type: String,
      required: true,
    },
    recieverUsername: {
      type: String,
      required: true,
    },
    recieverPic: {
      type: String,
      required: true,
    },
    notificationData: {
      type: [notificationDataschema],
      required: true,
    },
    createdDate: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// NotificationListSchema.index({ influencerId: 1, followerId: 1 }, { unique: true });

module.exports = model("NotificationList", NotificationListSchema);
