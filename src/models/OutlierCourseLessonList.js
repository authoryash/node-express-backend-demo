const { Schema, model } = require("mongoose");
const CourseLessonSchema = require("./CourseLessons");

const OutlierCourseLessonList = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    courseLessonList: {
      type: [CourseLessonSchema],
    },
    lessonCounts: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = model("OutlierCourseLessonList", OutlierCourseLessonList);
