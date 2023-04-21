"use strict";
const { Service } = require("../../system/services/Service");
const { NotificationService } = require("../services/NotificationService");

const autoBind = require("auto-bind");
const {
  lessonArrayLengthLimit,
  reservedFieldsForEditLessonOnDB,
  coursePerDiscoverQuery,
  mentorUserTable,
  courseTable,
  userCourseProgressTable,
} = require("../constants/index.constants");
const {
  OutlierCourseLessonsSchema,
  CoursesSchema,
  OutlierCourseBadgesSchema,
  UserCourseProgressSchema,
} = require("../models/index.models");
const { isEmpty } = require("lodash");
const { User } = require("../models/User");
const { Types } = require("mongoose");
const {
  setWellnessCategoriesInSequence,
} = require("../helpers/data-mutating-functions");

const getOutlierData = async (course, model, listParam) => {
  const extraData = await model.find(
    { courseId: course._id },
    `${listParam} -_id`
  );
  extraData.forEach((item) =>
    item[listParam].forEach((item) => course[listParam].push(item))
  );
};
const notificationService = new NotificationService();
class CourseService extends Service {
  constructor() {
    super();
    this.model = CoursesSchema;
    this.outlierLessonModel = OutlierCourseLessonsSchema;
    this.outlierBadgesModel = OutlierCourseBadgesSchema;
    this.userCourseProgressModel = UserCourseProgressSchema;
    autoBind(this);
  }

  async getCourseList(creatorId, pageNumber = 0, projection = {}) {
    try {
      // const data = await this.model
      //   .find({ creatorId, isItApproved: true }, projection)
      //   .skip(coursePerDiscoverQuery * pageNumber)
      //   .limit(coursePerDiscoverQuery);
      // await setWellnessCategoriesInSequence(data);
      projection["avgRating"] = { $first: "$avgRating.avgRating" };
      const data = await this.model.aggregate([
        {
          $match: {
            creatorId: Types.ObjectId(creatorId),
            isItApproved: true,
          },
        },
        { $skip: coursePerDiscoverQuery * pageNumber },
        { $limit: coursePerDiscoverQuery },
        {
          $lookup: {
            from: userCourseProgressTable,
            let: { id: "$_id" },
            pipeline: [
              {
                $match: {
                  $and: [
                    { isCompleted: true },
                    { ratings: { $exists: true } },
                    { ratings: { $ne: null } },
                    { $expr: { $eq: ["$$id", "$courseId"] } },
                  ],
                },
              },
              {
                $group: {
                  _id: "$ratings",
                  ratingCount: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: null,
                  weightedRating: {
                    $sum: { $multiply: ["$_id", "$ratingCount"] },
                  },
                  totalRatings: { $sum: "$ratingCount" },
                },
              },
              {
                $project: {
                  _id: 0,
                  avgRating: {
                    $cond: [
                      { $eq: ["$totalRatings", 0] },
                      0,
                      {
                        $round: [
                          { $divide: ["$weightedRating", "$totalRatings"] },
                          1,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            as: "avgRating",
          },
        },
        { $project: projection },
      ]);
      await setWellnessCategoriesInSequence(data);
      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getCourseDetails(_id, outlierRequired = true) {
    const course = await this.model.findOne({ _id });
    if (!course) return null;
    if (!outlierRequired && !course.hasMoreLessons && !course.hasMoreBadges)
      return course;
    if (course.hasMoreLessons)
      await getOutlierData(course, this.outlierLessonModel, "courseLessonList");
    if (course.hasMoreBadges)
      await getOutlierData(course, this.outlierBadgesModel, "courseBadgesList");
    return course;
  }

  async addLesson(data) {
    const { _id, lessonDetail, lessonCounts } = data;
    const { courseId } = lessonDetail;
    if (lessonCounts < lessonArrayLengthLimit) {
      const appendLessonInMainDoc = await this.model.findOneAndUpdate(
        {
          $and: [{ _id }, { lessonCounts: { $lt: lessonArrayLengthLimit } }],
        },
        [
          {
            $set: {
              courseLessonList: {
                $concatArrays: ["$courseLessonList", [lessonDetail]],
              },
              lessonCounts: {
                $add: ["$lessonCounts", 1],
              },
            },
          },
          {
            $set: {
              hasMoreLessons: {
                $cond: [
                  { $eq: ["$hasMoreLessons", true] },
                  true,
                  {
                    $cond: [
                      { $gte: ["$lessonCounts", lessonArrayLengthLimit] },
                      true,
                      false,
                    ],
                  },
                ],
              },
            },
          },
        ],
        { new: true }
      );
      return appendLessonInMainDoc;
    }
    const appendToOutlierDoc = await this.outlierLessonModel.findOneAndUpdate(
      {
        $and: [{ courseId }, { lessonCounts: { $lt: lessonArrayLengthLimit } }],
      },
      {
        $push: {
          courseLessonList: lessonDetail,
        },
        $inc: {
          lessonCounts: 1,
        },
      },
      { new: true, upsert: true }
    );
    return appendToOutlierDoc;
  }

  async updateLessonDetail(data) {
    const { courseId, lessonId, hasMoreLessons } = data;
    const updateData = {};
    Object.keys(data).forEach((key) => {
      if (!reservedFieldsForEditLessonOnDB.includes(key))
        updateData[`courseLessonList.$.${key}`] = data[key];
    });
    let updateDoc = null;
    updateDoc = await this.model.findOneAndUpdate(
      {
        _id: courseId,
        "courseLessonList._id": lessonId,
      },
      { $set: updateData },
      { new: true }
    );
    if (!updateDoc && hasMoreLessons) {
      updateDoc = await this.outlierLessonModel.findOneAndUpdate(
        {
          courseId,
          "courseLessonList._id": lessonId,
        },
        { $set: updateData },
        { new: true }
      );
    }
    return updateDoc;
  }

  async deleteLessonDetails(data) {
    const { _id, lessonId, hasMoreLessons } = data;
    let deleteDoc = null;
    deleteDoc = await this.model.findOneAndUpdate(
      {
        _id,
        "courseLessonList._id": lessonId,
      },
      {
        $pull: {
          courseLessonList: { _id: lessonId },
        },
        $inc: { lessonCounts: -1 },
      },
      { new: true }
    );
    if (!deleteDoc && hasMoreLessons) {
      deleteDoc = await this.outlierLessonModel.findOneAndUpdate(
        {
          courseId: _id,
          "courseLessonList._id": lessonId,
        },
        {
          $pull: {
            courseLessonList: { _id: lessonId },
          },
          $inc: { lessonCounts: -1 },
        },
        { new: true }
      );
      if (!isEmpty(deleteDoc) && deleteDoc.lessonCounts === 0) {
        deleteDoc = await this.outlierLessonModel.findOneAndDelete({
          _id: deleteDoc._id,
        });
      }
    }
    return deleteDoc;
  }

  async addQuestionsInDB(data) {
    try {
      const { _id, courseQuestions } = data;
      const courseUpdated = await this.model.findOneAndUpdate(
        { _id },
        { courseQuestions },
        { new: true }
      );
      if (isEmpty(courseUpdated)) throw "Question updation failed";
      return { result: true, data: courseUpdated };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async changeRatingPermission(data) {
    try {
      const { courseId: _id, ratingAllowed } = data;
      const courseUpdated = await this.model.findOneAndUpdate(
        { _id },
        { "ratings.ratingAllowed": ratingAllowed },
        { new: true }
      );
      return { result: true, data: courseUpdated };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async sendCourseForApproval(_id) {
    try {
      const courseUpdated = await this.model.findOneAndUpdate(
        { _id },
        { isInDrafts: false, isItApproved: true },
        { new: true }
      );
      return { result: true, data: courseUpdated };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getSampleCourseList({
    _id = null,
    alreadyFetchedCoursesId = [],
    role,
  } = {}) {
    try {
      let enrolledCoursescommon = [];
      if (role === "member") {
        let { enrolledCourses } = await User.findOne(
          { _id },
          "enrolledCourses -_id"
        );
        enrolledCoursescommon = enrolledCourses.map((item) => {
          return Types.ObjectId(item);
        });
      }

      const sampleCourses = await this.model.aggregate([
        {
          $match: {
            isItApproved: true,
            ...((alreadyFetchedCoursesId.length ||
              enrolledCoursescommon.length) && {
              _id: {
                $nin: [
                  ...alreadyFetchedCoursesId,
                  ...enrolledCoursescommon,
                  _id,
                ],
              },
            }),
          },
        },
        { $sample: { size: coursePerDiscoverQuery } },
        {
          $lookup: {
            from: userCourseProgressTable,
            let: { id: "$_id" },
            pipeline: [
              {
                $match: {
                  $and: [
                    { isCompleted: true },
                    { ratings: { $exists: true } },
                    { ratings: { $ne: null } },
                    { $expr: { $eq: ["$$id", "$courseId"] } },
                  ],
                },
              },
              {
                $group: {
                  _id: "$ratings",
                  ratingCount: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: null,
                  weightedRating: {
                    $sum: { $multiply: ["$_id", "$ratingCount"] },
                  },
                  totalRatings: { $sum: "$ratingCount" },
                },
              },
              {
                $project: {
                  _id: 0,
                  avgRating: {
                    $cond: [
                      { $eq: ["$totalRatings", 0] },
                      0,
                      {
                        $round: [
                          { $divide: ["$weightedRating", "$totalRatings"] },
                          1,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            as: "avgRating",
          },
        },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "creatorId",
            foreignField: "_id",
            pipeline: [{ $project: { userName: 1, _id: 0 } }],
            as: "mentordetails",
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                { $arrayElemAt: ["$mentordetails", 0] },
                "$$ROOT",
              ],
            },
          },
        },
        {
          $project: {
            thumbnailImageURL: 1,
            ratings: 1,
            courseTitle: 1,
            creatorId: 1,
            courseCreatorName: "$userName",
            courseCategories: 1,
            avgRating: { $first: "$avgRating.avgRating" },
          },
        },
      ]);
      await setWellnessCategoriesInSequence(sampleCourses);
      return { result: true, data: sampleCourses };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async searchCourse(query, pageNumber, projection = {}) {
    try {
      const searchKey = query;
      projection["avgRating"] = { $first: "$avgRating.avgRating" };
      projection["courseCreator"] = { $first: "$courseCreator" };
      const getdata = await this.model.aggregate([
        {
          $match: {
            isItApproved: true,
            $or: [
              { courseTitle: { $regex: `^(?i)${searchKey}` } },
              {
                wellnessCategories: {
                  $elemMatch: { categoryName: { $regex: `^(?i)${searchKey}` } },
                },
              },
            ],
          },
        },
        { $skip: coursePerDiscoverQuery * pageNumber },
        { $limit: coursePerDiscoverQuery },
        {
          $lookup: {
            from: userCourseProgressTable,
            let: { id: "$_id" },
            pipeline: [
              {
                $match: {
                  $and: [
                    { isCompleted: true },
                    { ratings: { $exists: true } },
                    { ratings: { $ne: null } },
                    { $expr: { $eq: ["$$id", "$courseId"] } },
                  ],
                },
              },
              {
                $group: {
                  _id: "$ratings",
                  ratingCount: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: null,
                  weightedRating: {
                    $sum: { $multiply: ["$_id", "$ratingCount"] },
                  },
                  totalRatings: { $sum: "$ratingCount" },
                },
              },
              {
                $project: {
                  _id: 0,
                  avgRating: {
                    $cond: [
                      { $eq: ["$totalRatings", 0] },
                      0,
                      {
                        $round: [
                          { $divide: ["$weightedRating", "$totalRatings"] },
                          1,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            as: "avgRating",
          },
        },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "creatorId",
            foreignField: "_id",
            pipeline: [
              { $project: { userName: 1, name: 1, _id: 0, profilePic: 1 } },
            ],
            as: "courseCreator",
          },
        },
        { $project: projection },
      ]);

      await setWellnessCategoriesInSequence(getdata);

      return { result: true, getdata };
    } catch (error) {
      return { result: false, getdata: error };
    }
  }
  async getCoursesListByWellnessCategories(
    pageNumber = 0,
    _id,
    wellnessCategories
  ) {
    try {
      let { enrolledCourses } = await User.findOne(
        { _id },
        "enrolledCourses -_id"
      );
      enrolledCourses = enrolledCourses.map((item) => {
        return Types.ObjectId(item);
      });
      const data = await this.model.aggregate([
        {
          $match: {
            isItApproved: true,
            courseCategories: wellnessCategories,
            _id: { $nin: enrolledCourses },
          },
        },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "creatorId",
            foreignField: "_id",
            pipeline: [{ $project: { userName: 1, _id: 0 } }],
            as: "mentordetails",
          },
        },
        {
          $lookup: {
            from: "usercourseprogresses",
            let: { courseId: "$_id" },
            pipeline: [
              {
                $match: { $expr: { $eq: ["$courseId", "$$courseId"] } },
              },
              {
                $group: {
                  _id: "$ratings",
                  count: {
                    $sum: 1,
                  },
                },
              },
            ],
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "wellnesscategories",
            pipeline: [
              {
                $match: {
                  _id: Types.ObjectId(wellnessCategories),
                },
              },
              { $project: { categoryName: 1, _id: 0 } },
            ],
            as: "categoryName",
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                { $arrayElemAt: ["$mentordetails", 0] },
                // "$ratings",
                "$$ROOT",
              ],
            },
          },
        },
        { $skip: coursePerDiscoverQuery * pageNumber },
        { $limit: coursePerDiscoverQuery },
        {
          $project: {
            thumbnailImageURL: 1,
            ratings: 1,
            courseTitle: 1,
            creatorId: 1,
            courseCreatorName: "$userName",
            courseCategories: 1,
            isItApproved: 1,
            categoryName: { $first: "$categoryName.categoryName" },
          },
        },
      ]);
      return {
        result: true,
        data: data,
      };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getCourseProgress({ courseId, _id }) {
    try {
      const data = await this.model.aggregate([
        {
          $match: {
            _id: Types.ObjectId(courseId),
          },
        },
        {
          $lookup: {
            from: "usercourseprogresses",
            localField: "_id",
            foreignField: "courseId",
            let: {
              countlesson: "$lessonCounts",
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$userId", Types.ObjectId(_id)] },
                },
              },
              {
                $addFields: {
                  progress: {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $size: "$completedLessons",
                          },
                          "$$countlesson",
                        ],
                      },
                      100,
                    ],
                  },
                },
              },
            ],
            as: "progress",
          },
        },
        {
          $project: {
            totalprogress: [{ $first: "$progress.progress" }],
            review: [{ $first: "$progress.review" }],
            ratings: 1,
          },
        },
      ]);
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getUserCoursesTitlesServices({ _id, role }) {
    try {
      _id = Types.ObjectId(_id);
      let model = null;
      let findParam = null;
      let pipeline = [];
      if (role === "mentor") {
        model = this.model;
        findParam = { creatorId: _id, isItApproved: true };
        pipeline = [{ $project: { courseTitle: 1 } }];
      }
      if (role === "member") {
        model = this.userCourseProgressModel;
        findParam = { userId: _id };
        pipeline = [
          {
            $lookup: {
              from: courseTable,
              localField: "courseId",
              foreignField: "_id",
              pipeline: [{ $project: { courseTitle: 1 } }],
              as: "courseDetails",
            },
          },
          {
            $project: {
              courseTitle: { $first: "$courseDetails.courseTitle" },
            },
          },
        ];
      }
      const getUserCoursesList = await model.aggregate([
        { $match: findParam },
        ...pipeline,
      ]);
      return { result: true, data: getUserCoursesList };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async courseProgressValidation({ _id, courseId, lessonId, Type }) {
    const user = await User.findOne({ _id });
    if (isEmpty(user)) throw "User not found or he is not member";
    let course;
    let outlierCourse;
    if (Type === "update") {
      course = await this.model.findOne({
        _id: Types.ObjectId(courseId),
        "courseLessonList._id": Types.ObjectId(lessonId),
        isItApproved: true,
      });
      outlierCourse = await this.outlierLessonModel.findOne({
        _id: Types.ObjectId(courseId),
        "courseLessonList._id": Types.ObjectId(lessonId),
        isItApproved: true,
      });
    } else {
      course = await this.model.findOne({
        _id: Types.ObjectId(courseId),
        isItApproved: true,
      });
      outlierCourse = await this.outlierLessonModel.findOne({
        _id: Types.ObjectId(courseId),
        isItApproved: true,
      });
    }
    if (isEmpty(course) && isEmpty(outlierCourse))
      throw "course not found or it is not approved or lesson doesn't exist";
    const courseProgress = await this.userCourseProgressModel.findOne({
      userId: Types.ObjectId(_id),
      courseId: Types.ObjectId(courseId),
    });
    if (isEmpty(courseProgress) && Type !== "create") {
      throw "courseprogress not found ";
    } else if (!isEmpty(courseProgress) && Type === "create") {
      throw "course is already signup";
    } else if (
      !isEmpty(courseProgress) &&
      courseProgress.isCompleted === true
    ) {
      throw "course is already completed";
    }

    return user;
  }

  async createCourseProgress({ _id, courseId }) {
    try {
      const user = await this.courseProgressValidation({
        _id,
        courseId,
        Type: "create",
      });
      const data = await this.userCourseProgressModel.create({
        userId: _id,
        courseId,
        userName: user.name,
        userPic: user.profilePic,
      });
      if (isEmpty(data)) throw "course progress cant be created";
      const courseData = await this.model.findByIdAndUpdate(
        {
          _id: Types.ObjectId(courseId),
        },
        {
          $inc: { userOngoing: 1 },
        }
      );
      if (isEmpty(courseData)) throw "course complete updation fail";
      const enrollCourseInUser = await User.updateOne(
        { _id },
        { $addToSet: { enrolledCourses: courseId } }
      );
      if (isEmpty(enrollCourseInUser)) {
        await this.userCourseProgressModel.deleteOne({
          _id: data._id,
        });
        throw "course progress cant be creted because user cant be created";
      }
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async updateProgressLessonDetail({ _id, courseId, lessonId }) {
    try {
      await this.courseProgressValidation({
        _id,
        courseId,
        lessonId,
        Type: "update",
      });
      const data = await this.userCourseProgressModel.findOneAndUpdate(
        {
          userId: Types.ObjectId(_id),
          courseId: Types.ObjectId(courseId),
          "completedLessons.lessonId": { $ne: lessonId },
        },
        {
          $addToSet: {
            completedLessons: { lessonId: lessonId },
          },
        },
        {
          rawResult: true,
          new: true,
        }
      );
      if (isEmpty(data)) throw "lesson completion failed";
      if (data.value === null) throw "lesson is already completed";
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async updateCourseCompleteDetail({
    _id,
    courseId,
    review,
    ratings,
    courseQuestionAnswers,
    // questionId,
    // question,
    // questionAnswer,
  }) {
    try {
      await this.courseProgressValidation({
        _id,
        courseId,
        Type: "complete",
      });

      const data = await this.userCourseProgressModel.findOneAndUpdate(
        {
          userId: Types.ObjectId(_id),
          courseId: Types.ObjectId(courseId),
        },
        {
          $set: {
            review: review,
            ratings: ratings,
            $push: { courseQuestionAnswers: courseQuestionAnswers },
            isCompleted: true,
          },
        },
        {
          rawResult: true,
        }
      );
      if (isEmpty(data)) throw "lesson completion failed";
      if (data.value === null) throw "lesson is already completed";
      const courseData = await this.model.findByIdAndUpdate(
        {
          _id: Types.ObjectId(courseId),
        },
        {
          $inc: { userCompletedCourse: 1, userOngoing: -1 },
        }
      );
      if (isEmpty(courseData)) throw "course complete updation fail";
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getCourseInfoInterface({ courseId }) {
    try {
      const data = await this.model.aggregate([
        {
          $match: {
            _id: Types.ObjectId(courseId),
          },
        },
        {
          $lookup: {
            from: "usercourseprogresses",
            pipeline: [
              {
                $match: {
                  $and: [
                    {
                      $expr: {
                        $and: [
                          { $eq: ["$courseId", Types.ObjectId(courseId)] },
                          { $eq: ["$isCompleted", true] },
                        ],
                      },
                    },
                    { review: { $exists: true } },
                    { review: { $ne: "" } },
                  ],
                },
              },
              {
                $project: {
                  review: 1,
                  userName: 1,
                  userPic: 1,
                  createdAt: 1,
                  _id: 0,
                },
              },
            ],
            as: "review",
          },
        },
        {
          $lookup: {
            from: "mentors",
            let: {
              creatorId: "$creatorId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$creatorId"],
                  },
                },
              },
              {
                $project: {
                  name: 1,
                  userName: 1,
                  _id: 0,
                },
              },
            ],
            as: "createdBy",
          },
        },
        {
          $unwind: {
            path: "$courseLessonList",
          },
        },
        {
          $group: {
            _id: "$_id",
            main: {
              $first: "$$ROOT",
            },
            articles: {
              $sum: 1,
            },
            videoduration: {
              $sum: "$courseLessonList.lessonDuration",
            },
          },
        },
      ]);

      if (isEmpty(data)) throw "course might not contain any lesson ";
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async courseRatings({ /* userId, */ courseId }) {
    try {
      courseId = Types.ObjectId(courseId);
      //userId = Types.ObjectId(userId);
      const data = await UserCourseProgressSchema.aggregate([
        {
          $match: {
            courseId,
            isCompleted: true,
          },
        },
        {
          $group: {
            _id: "$ratings",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            rating: "$_id",
            _id: 0,
            count: 1,
          },
        },
      ]);
      if (isEmpty(data)) throw "course info failed";
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async courseLessonlist({ courseId }) {
    try {
      const course = await this.model.findOne({
        _id: Types.ObjectId(courseId),
      });
      let data;
      const pipeline = [
        {
          $match: {
            _id: Types.ObjectId(courseId),
          },
        },
        {
          $unwind: {
            path: "$courseLessonList",
          },
        },
        {
          $addFields: {
            readings: {
              $cond: [
                {
                  $or: [
                    {
                      $ne: ["$courseLessonList.lessonPdfURL", ""],
                    },
                    {
                      $ne: ["$courseLessonList.lessonDescription", ""],
                    },
                  ],
                },
                "readings",
                "no readings",
              ],
            },
            time: {
              $cond: [
                {
                  $ne: ["$courseLessonList.lessonDuration", 0],
                },
                "$courseLessonList.lessonDuration",
                "",
              ],
            },
          },
        },
        {
          $lookup: {
            from: "mentors",
            let: {
              creatorId: "$creatorId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$creatorId"],
                  },
                },
              },
              {
                $project: {
                  name: 1,
                  userName: 1,
                  _id: 0,
                },
              },
            ],
            as: "createdBy",
          },
        },
        {
          $addFields: {
            // time: {
            //   $cond: [
            //     {
            //       $ne: ["$courseLessonList.lessonDuration", ""],
            //     },
            //     "$courseLessonList.lessonDuration",
            //     "",
            //   ],
            // },
            courseRatingAllowed: {
              courseRatingAllowed: "$ratings.ratingAllowed",
            },
            courseTitle: { courseTitle: "$courseTitle" },
            courseDiscription: { courseDescription: "$courseDescription" },
            courseCreatedBy: { createdBy: "$createdBy" },
            lessonDetail: "$courseLessonList",
            lessonTime: { time: "$time" },
            lessonReading: { readings: "$readings" },
          },
        },
        // {
        //   $lookup: {
        //     from: "usercourseprogresses",
        //     let: {
        //       courseId: Types.ObjectId(courseId),
        //       userId: Types.ObjectId(_id),
        //       lessonId: "$courseLessonList._id",
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           $and: [
        //             { $expr: { $eq: ["$courseId", "$$courseId"] } },
        //             { $expr: { $eq: ["$userId", "$$userId"] } },
        //             {
        //               $expr: { $eq: ["$completedLessons._id", "$$lessonId"] },
        //             },
        //           ],
        //         },
        //       },
        //     ],
        //     as: "completed",
        //   },
        // },
        {
          $addFields: {
            // lessonDetails: "$courseLessonList",
            // "lessonDetails.time": "$time",
            // "lessonDetails.readings": "$readings",
            // completed: 1,
            lessonDetails: {
              $mergeObjects: [
                { courseQuestions: "$courseQuestions" },
                "$lessonDetail",
                "$lessonTime",
                "$lessonReading",
                "$courseCreatedBy",
                "$courseDiscription",
                "$courseTitle",
                "$courseRatingAllowed",
              ],
            },
          },
        },
        { $replaceRoot: { newRoot: "$lessonDetails" } },
      ];
      if (course.hasMoreLessons) {
        data = await this.outlierLessonModel.aggregate([...pipeline]);
      } else {
        data = await this.model.aggregate([...pipeline]);
      }
      return { result: true, data: data };
    } catch (error) {
      return { result: true, data: error };
    }
  }
  async lessonInfo({ lessonId, courseId }) {
    try {
      lessonId = Types.ObjectId(lessonId);
      courseId = Types.ObjectId(courseId);
      const data = await this.model.aggregate([
        {
          $unwind: "$courseLessonList",
        },
        {
          $match: {
            _id: courseId,
            "courseLessonList._id": lessonId,
          },
        },
        {
          $lookup: {
            from: "mentors",
            let: {
              creatorId: "$creatorId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$creatorId"],
                  },
                },
              },
              {
                $project: {
                  name: 1,
                  userName: 1,
                  _id: 0,
                },
              },
            ],
            as: "createdBy",
          },
        },
        {
          $project: {
            courseLessonList: 1,
            createdBy: 1,
            _id: 0,
          },
        },
      ]);
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async courseProgressLessonlist({ _id, courseId }) {
    try {
      const data = await UserCourseProgressSchema.aggregate([
        {
          $match: {
            userId: Types.ObjectId(_id),
            courseId: Types.ObjectId(courseId),
          },
        },
        {
          $project: {
            completedLessons: 1,
            _id: 0,
          },
        },
      ]);

      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async myCourses({ _id }) {
    try {
      const data = await UserCourseProgressSchema.aggregate([
        {
          $match: {
            userId: Types.ObjectId(_id),
          },
        },
        {
          $group: {
            _id: "$courseId",
            isCompleted: {
              $first: "$isCompleted",
            },
            completedLessons: {
              $first: "$completedLessons",
            },
            total: {
              $sum: 1,
            },
          },
        },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            let: {
              completedLessons: "$completedLessons",
            },
            pipeline: [
              {
                $addFields: {
                  progress: {
                    $cond: [
                      { $eq: [{ $size: "$$completedLessons" }, 0] },
                      0,
                      {
                        $multiply: [
                          {
                            $divide: [
                              {
                                $size: "$$completedLessons",
                              },
                              "$lessonCounts",
                            ],
                          },
                          100,
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  courseId: "$_id",
                  courseTitle: 1,
                  lessonCounts: 1,
                  courseDescription: 1,
                  thumbnailImageURL: 1,
                  progress: 1,
                  creatorId: 1,
                  userOngoing: 1,
                  userCompletedCourse: 1,
                },
              },
            ],
            as: "courseDetails",
          },
        },
        {
          $lookup: {
            from: "mentors",
            let: {
              creatorId: { $first: "$courseDetails.creatorId" },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$creatorId"],
                  },
                },
              },
              {
                $project: {
                  name: 1,
                  userName: 1,
                  profilePic: 1,
                  _id: 0,
                },
              },
            ],
            as: "createdBy",
          },
        },
        {
          $project: {
            courseDetails: 1,
            isCompleted: 1,
            createdBy: 1,
          },
        },
      ]);
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async updateCompleteCourseList({ _id, courseId, newEarnedBadges }) {
    await this.userCourseProgressModel.findOneAndUpdate(
      {
        userId: _id,
        courseId,
      },
      [
        {
          $set: {
            earnedBadges: { $concatArrays: ["$earnedBadges", newEarnedBadges] },
          },
        },
      ],
      { new: true }
    );
  }
  async getBadgeDetails(badgeArray) {
    try {
      badgeArray = badgeArray.map((item) => item.badgeId);

      const data = await this.model.find(
        {
          courseBadgesList: {
            $elemMatch: { _id: { $in: badgeArray } },
          },
        },
        {
          "courseBadgesList.badgeName": 1,
          "courseBadgesList.badgeDescription": 1,
          _id: 0,
        }
      );
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async getFCMToken(ids) {
    try {
      const data = await User.aggregate([
        {
          $match: {
            _id: ids,
          },
        },
        {
          $project: {
            FCMToken: 1,
            _id: 1,
            userName: 1,
            role: 1,
            profilePic: 1,
          },
        },
      ]);
      return data;
    } catch (error) {
      return error;
    }
  }
  async courseListDetails(ids) {
    try {
      const data = await this.model.aggregate([
        {
          $match: {
            _id: ids,
          },
        },
        {
          $project: { courseTitle: 1, _id: 1 },
        },
      ]);
      return data;
    } catch (error) {
      return error;
    }
  }
  async cronJob() {
    try {
      const userAndCourseId = await this.userCourseProgressModel.find(
        {
          isCompleted: false,
          $expr: {
            $lt: [
              "$createdAt",
              {
                $dateSubtract: {
                  startDate: "$$NOW",
                  unit: "hour",
                  amount: 48,
                },
              },
            ],
          },
        },
        { userId: 1, courseId: 1, _id: 0 }
      );

      for (let index = 0; index < userAndCourseId.length; index++) {
        const element = userAndCourseId[index];
        console.log(
          "🚀 ~ file: CourseService.js:1451 ~ CourseService ~ cronJob ~ element",
          element
        );
        let ids = element.userId;
        let courseIds = element.courseId;

        let FCMTokenInitial = await this.getFCMToken(ids);
        console.log(
          "🚀 ~ file: CourseService.js:1456 ~ CourseService ~ cronJob ~ FCMTokenInitial",
          FCMTokenInitial
        );

        let courseInitial = await this.courseListDetails(courseIds);

        let FCMToken = FCMTokenInitial.filter((item) => {
          return !isEmpty(item) && item.FCMToken;
        });
        let courseTitle = courseInitial.filter((item) => {
          return !isEmpty(item) && item.courseTitle;
        });

        if (FCMToken[0].FCMToken) {
          let message = {
            notification: {
              title: "demo",
              body: `your subscribed course ${courseTitle[0].courseTitle} is not completed`,
            },
          };
          let registrationToken = FCMToken[0].FCMToken;

          const notificationData = await notificationService.sendNotification({
            registrationToken,
            message,
          });

          return notificationData;
        }
      }
    } catch (error) {
      return error;
    }
  }
}

module.exports = new CourseService();
