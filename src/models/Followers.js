const { Schema, model } = require("mongoose");

const FollowersListSchema = new Schema(
  {
    influencerId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    influencerRole: {
      type: String,
      required: true,
    },
    followerId: {
      type: Schema.Types.ObjectId,
    },
    followerRole: {
      type: String,
      required: true,
    },
    currentFollowStatus: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

FollowersListSchema.index({ influencerId: 1, followerId: 1 }, { unique: true });

module.exports = model("FollowersList", FollowersListSchema);
