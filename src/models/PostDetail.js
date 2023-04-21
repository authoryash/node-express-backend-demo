const { Schema, model } = require("mongoose");
const PostDetailSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    communityTags: {
      type: [String],
    },
    description: {
      type: String,
    },
    usersMentions: {
      type: [Schema.Types.ObjectId],
    },
    caloriesBurnt: {
      type: Number,
    },
    linkedCourse: {
      type: [Schema.Types.ObjectId],
    },
    linkedBadge: {
      type: [Schema.Types.ObjectId],
    },
    roles: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    userLiked: {
      type: [String],
    },
    likeCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PostDetailSchema.index({ createdAt: -1 });

module.exports = model("postdetails", PostDetailSchema);
