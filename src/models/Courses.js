const { Schema, model } = require("mongoose");
const CourseBadgeSchema = require("./CourseBadges");
const CourseLessonSchema = require("./CourseLessons");

const CourseQuestionSchema = new Schema(
  {
    questionNumber: {
      type: Number,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);
// const RatingValueSchema = new Schema({
//   value: {
//     type: Number,
//     default: 0,
//   },
//   count: {
//     type: Number,
//     default: 0,
//   },
// });
const RatingSchema = new Schema(
  {
    ratingAllowed: {
      type: Boolean,
      default: false,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    ratingValue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: false, _id: false }
);

const CourseSchema = new Schema(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    thumbnailImageURL: {
      type: String,
      required: true,
    },
    introVideoURL: {
      type: String,
      required: true,
    },
    courseTitle: {
      type: String,
      required: true,
    },
    courseDescription: {
      type: String,
      // required: true,
    },
    courseCategories: {
      type: [String],
      required: true,
    },
    isItApproved: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
    },
    courseLessonList: {
      type: [CourseLessonSchema],
      default: [],
    },
    lessonCounts: {
      type: Number,
      default: 0,
    },
    hasMoreLessons: {
      type: Boolean,
      default: false,
    },
    courseBadgesList: {
      type: [CourseBadgeSchema],
      default: [],
    },
    badgesCount: {
      type: Number,
      default: 0,
    },
    hasMoreBadges: {
      type: Boolean,
      default: false,
    },
    courseQuestions: {
      type: [CourseQuestionSchema],
    },
    courseLearnings: {
      type: [String],
    },
    userCompletedCourse: {
      type: Number,
      default: 0,
    },
    userOngoing: {
      type: Number,
      default: 0,
    },
    ratings: {
      type: RatingSchema,
      default: {
        ratingAllowed: false,
        ratingCount: 0,
        ratingValue: 0,
      },
    },
  },
  { timestamps: true }
);

module.exports = model("Courses", CourseSchema);
