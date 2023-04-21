const { Schema, model } = require("mongoose");

const UserCourseProgressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    userName: {
      type: String,
    },
    userPic: {
      type: String,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    ratings: {
      type: Number,
    },
    completedLessons: {
      type: [
        {
          lessonId: {
            type: Schema.Types.ObjectId,
            required: true,
          },
          completedAt: {
            type: Date,
            default: new Date(),
          },
        },
      ],
      default: [],
    },
    earnedBadges: {
      type: [
        {
          badgeId: {
            type: Schema.Types.ObjectId,
            required: true,
          },
          earnedOn: {
            type: Date,
            default: new Date(),
          },
        },
      ],
      default: [],
    },
    courseQuestionAnswers: {
      type: [
        {
          questionId: {
            type: Schema.Types.ObjectId,
            required: true,
          },
          question: {
            type: String,
            required: true,
          },
          questionAnswer: {
            type: String,
            required: true,
          },
        },
      ],
      default: [],
    },
    review: {
      type: String,
    },
    progress: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = model("UserCourseProgress", UserCourseProgressSchema);
