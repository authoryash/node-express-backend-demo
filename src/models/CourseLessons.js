const { Schema } = require("mongoose");
const lessonIsCompletedSchema = new Schema(
  {
    completed: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);
const CourseLessonSchema = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    lessonNumber: {
      type: Number,
      required: true,
    },
    lessonTitle: {
      type: String,
      required: true,
    },
    lessonDescription: {
      type: String,
      // required: true,
    },
    // lessonDay: {
    //   type: Number,
    //   required: true,
    // },
    lessonDuration: {
      type: Number,
      default: 0,
      // required: true,
    },
    lessonVideoURL: {
      type: String,
      // required: true,
    },
    lessonPdfURL: {
      type: String,
    },
    isCompleted: {
      type: [lessonIsCompletedSchema],
      // default: false,
    },
  },
  { timestamps: true }
);

module.exports = CourseLessonSchema;
