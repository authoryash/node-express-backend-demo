const { Schema, model } = require("mongoose");
const CourseBadgeSchema = require("./CourseBadges");

const OutlierCourseBadgeList = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    courseBadgesList: {
      type: [CourseBadgeSchema],
      default: [],
    },
    badgesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = model("OutlierCourseBadgeList", OutlierCourseBadgeList);
