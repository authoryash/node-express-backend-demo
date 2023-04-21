const autoBind = require("auto-bind");
const MentorUser = require("../models/MentorUser");
const { UserService } = require("./../services/UserService");
const { User } = require("./../models/User");
const MentorUserService = require("../services/MentorUserService");
const { Success } = require("../utils/httpHandlers");
const {
  uploadVideo,
  DeleteObjects,
  RenameObject,
} = require("../middlewares/index.middleware");
const {
  WellnessCategoriesSchema,
  BadgeTriggersSchema,
} = require("../models/index.models");
const { isEmpty } = require("lodash");
const CourseService = require("../services/CourseService");
const { Types } = require("mongoose");
const {
  lessonNumberReplaceRegex,
  editLessonFields,
} = require("../constants/index.constants");
const { CatchErrorHandler } = require("../utils/common-error-handlers");
const {
  editLessonDataValidator,
  addLessonToCourseBodyDataValidator,
} = require("../helpers/index.helper");
const BadgeService = require("../services/BadgeService");
const userService = new UserService(User, MentorUser);
const { NotificationService } = require("../services/NotificationService");

class MentorController {
  constructor(service) {
    this.service = service;
    this.courseService = CourseService;
    this.notificationService = new NotificationService();
    autoBind(this);
  }

  async registerCourse(req, res) {
    let thumbnailImageKey = "",
      courseIntroVideoKey = "";
    try {
      uploadVideo.fields([
        { name: "courseIntroVideo", maxCount: 1 },
        { name: "courseThumbnailImage", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) throw err.message;
        try {
          let {
            creatorId = "",
            courseTitle = "",
            tags = [],
            courseCategories = [],
            courseDescription = "",
            courseLearnings = [],
          } = req.body;
          if (!creatorId) throw "Creator Id is not provided";
          if (!courseTitle) throw "Course Title is not provided";
          if (!courseDescription) throw "Course description is required";
          const { courseId: _id = "" } = req.query;

          const {
            courseThumbnailImage: [
              { location: thumbnailImageURL, key: thumbnailImageKeyVal },
            ] = [{ location: "", key: "" }],
            courseIntroVideo: [
              { location: introVideoURL, key: courseIntroVideoKeyVal },
            ] = [{ location: "", key: "" }],
          } = req.files;
          thumbnailImageKey = thumbnailImageKeyVal;
          courseIntroVideoKey = courseIntroVideoKeyVal;
          if (!thumbnailImageURL)
            throw "Thumbnail image is not uploaded on cloud";
          if (!introVideoURL)
            throw "Introduction video is not uploaded on cloud";
          const creator = await MentorUser.findOne({ _id: creatorId });
          if (!creator) throw "User doesn't exists";
          courseCategories = courseCategories.split(",");
          courseLearnings = courseLearnings.split(",");
          if (!courseCategories.length)
            throw "Course categories are not provided";
          let wellnessCategories = await WellnessCategoriesSchema.find(
            {},
            "_id"
          );
          wellnessCategories = wellnessCategories.map((item) =>
            item._id.toString()
          );
          const invalidCourseCategory = courseCategories.some(
            (item) => !wellnessCategories.includes(item)
          );
          if (invalidCourseCategory) throw "Invalid course categories exists";
          const course = await this.courseService.insert({
            _id,
            creatorId,
            courseTitle,
            courseCategories,
            introVideoURL,
            thumbnailImageURL,
            tags,
            courseDescription,
            courseLearnings,
          });
          if (isEmpty(course)) throw "Course creation failed";

          const followersId = await userService.getFollowingList(creator._id);

          let ids = followersId.data.map((item) => {
            return Types.ObjectId(item.followerId);
          });

          let FCMTokenInitial = await userService.getFCMToken(ids);

          let FCMToken = FCMTokenInitial.filter((item) => {
            return !isEmpty(item) && item.FCMToken;
          });
          let registrationToken = FCMToken.map((item) => {
            return item.FCMToken;
          });

          if (registrationToken) {
            let message = {
              notification: {
                title: "demo",
                body: `${creator.name} created new course ${courseTitle}`,
              },
            };
            const notificationData = await this.service.sendNotification({
              registrationToken,
              message,
            });

            if (notificationData.results) {
              for (let index = 0; index < FCMTokenInitial.length; index++) {
                const element = FCMTokenInitial[index];

                let storingData = {};
                let setData = [];
                storingData["recieverId"] = element._id;
                storingData["recieverRole"] = element.role;
                storingData["recieverUsername"] = element.userName;
                storingData["recieverPic"] = element.profilePic;
                storingData["createdDate"] = new Date().toLocaleDateString();
                setData.push({
                  senderId: creator._id,
                  senderRole: creator.role,
                  senderUsername: creator.userName,
                  senderPic: creator.profilePic,
                  description: message.notification.body,
                  notificationType: "CourseCreated",
                  notificationSent:
                    notificationData.successCount === 1 ? true : false,
                  createdAt: new Date(),
                });
                const setNotificationData =
                  await this.notificationService.setNotification(
                    storingData,
                    setData
                  );
                console.log(
                  "🚀 ~ file: UserController.js:230 ~ UserController ~ followUser ~ notificationData",
                  setNotificationData
                );
              }
            }
          }
          return Success(res, 200, "Course created successfully", course);
        } catch (error) {
          if (thumbnailImageKey || courseIntroVideoKey)
            DeleteObjects([
              ...(thumbnailImageKey ? [{ Key: thumbnailImageKey }] : []),
              ...(courseIntroVideoKey ? [{ Key: courseIntroVideoKey }] : []),
            ]);
          return CatchErrorHandler(res, error, "Course registration");
        }
      });
    } catch (error) {
      return CatchErrorHandler(res, error, "Course registration");
    }
  }

  async addLesson(req, res) {
    let lessonKey = "";
    let lessonPdfKey = "";
    try {
      uploadVideo.fields([
        { name: "lessonVideo", maxCount: 1 },
        { name: "lessonPdf", maxCount: 1 },
      ])(req, res, async (err) => {
        try {
          if (err) throw err.message;
          // if (!req.file) {
          const errorVal = addLessonToCourseBodyDataValidator({
            ...req.body,
          });
          if (errorVal) throw errorVal;
          // }
          const {
            courseId = "",
            lessonNumber = "",
            lessonTitle = "",
            lessonDescription = "",
            // lessonDay = "",
            lessonDuration = 0,
            // lessonPdf = "",
          } = req.body;
          const { _id: creatorId, lessonId, role } = req.query;

          const {
            lessonVideo: [{ location: lessonVideoURL, key: lessonKeyVal }] = [
              { location: "", key: "" },
            ],
            lessonPdf: [{ location: lessonPdfURL, key: lessonPdfKeyVal }] = [
              { location: "", key: "" },
            ],
          } = req.files;

          lessonKey = lessonKeyVal;
          lessonPdfKey = lessonPdfKeyVal;
          if (
            req.body.lessonVideo &&
            req.body.lessonVideo !== "null" &&
            !lessonVideoURL
          )
            throw "lesson video not uploaded on cloud";
          if (
            req.body.lessonPdf &&
            req.body.lessonPdf !== "null" &&
            !lessonPdfURL
          )
            throw "lesson pdf is not uploaded on cloud";
          if (role !== "mentor") throw "Only mentor can create lesson";
          // if (!!req.file && !location && !key)
          //   throw "Issue on file uploading in cloud, please try again";
          const course = await this.courseService.getCourseDetails(courseId);
          if (!course) throw "Course doesn't exists";
          if (course.creatorId.toString() !== creatorId)
            throw "Course is not created by current user";
          for (let lesson of course.courseLessonList) {
            if (lesson.lessonNumber.toString() === lessonNumber)
              throw "Lesson with same lesson number already exists";
            if (lesson.lessonTitle === lessonTitle)
              throw "Lesson with same title already exists";
          }
          const data = {
            _id: Types.ObjectId(courseId),
            lessonDetail: {
              _id: Types.ObjectId(lessonId),
              courseId: Types.ObjectId(courseId),
              lessonNumber,
              lessonTitle,
              lessonDescription,
              // lessonDay,
              lessonDuration: Number(lessonDuration),
              lessonVideoURL: lessonVideoURL,
              lessonPdfURL: lessonPdfURL,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            lessonCounts: course.lessonCounts,
          };
          const addLesson = await this.courseService.addLesson(data);
          if (isEmpty(addLesson)) throw "Lesson addition failed";
          return Success(res, 200, "Lesson added successfully", addLesson);
        } catch (error) {
          return CatchErrorHandler(
            res,
            error,
            "Addition of lesson",
            lessonKey,
            lessonPdfKey
          );
        }
      });
    } catch (error) {
      return CatchErrorHandler(res, error, "Addition of lesson");
    }
  }

  async getLessonDetails(req, res) {
    try {
      const { lessonId, courseId } = req.query;
      const { _id: creatorId } = req.body;
      const course = await this.courseService.getCourseDetails(courseId);
      if (course.creatorId.toString() !== creatorId)
        throw "Course is not created by current user";
      const findLesson = course.courseLessonList.find(
        (lesson) => lesson._id.toString() === lessonId
      );
      if (!findLesson) throw "Lesson doesn't exist in given course";
      return Success(
        res,
        200,
        "Lesson details fetched successfully",
        findLesson
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Fetching lesson detail");
    }
  }

  async editLesson(req, res) {
    let lessonKey = "";
    let lessonPdfKey = "";
    try {
      uploadVideo.fields([
        { name: "editLessonVideo", maxCount: 1 },
        { name: "lessonPdf", maxCount: 1 },
      ])(req, res, async (err) => {
        try {
          if (err) throw err.message;
          const data = {};
          editLessonFields.forEach((item) => {
            if (Object.prototype.hasOwnProperty.call(req.body, item))
              data[item] = req.body[item];
          });
          if (data["lessonDescription"] === null) {
            data["lessonDescription"] = "";
          }
          if (req.files.editLessonVideo === null && req.body.currentVideoURL) {
            data.currentVideoURL = decodeURI(data.currentVideoURL);
            const tempCurrentURLArray = data.currentVideoURL.split("/");
            data["lessonVideoURL"] = "";
            data["lessonDuration"] = 0;
            const OLD_KEY = tempCurrentURLArray
              .slice(tempCurrentURLArray.indexOf("courses"))
              .join("/");
            await DeleteObjects([{ Key: OLD_KEY }]);
          }
          if (req.files.lessonPdf === null && req.body.currentPdfURL) {
            data.currentPdfURL = decodeURI(data.currentPdfURL);
            const tempCurrentURLArray = data.currentPdfURL.split("/");
            data["lessonPdfURL"] = "";
            const OLD_KEY = tempCurrentURLArray
              .slice(tempCurrentURLArray.indexOf("courses"))
              .join("/");
            await DeleteObjects([{ Key: OLD_KEY }]);
          }
          const { _id: creatorId, role } = req.query;
          if (role !== "mentor") throw "Only mentor can edit course";
          data["creatorId"] = creatorId;
          const {
            editLessonVideo: [{ location: lessonVideoURL }] = [
              { location: "" },
            ],
            lessonPdf: [{ location: lessonPdfURL }] = [{ location: "" }],
          } = req.files;

          data["lessonVideoURL"] = lessonVideoURL;
          data["req.body"] = req?.body?.lessonDuration
            ? req?.body?.lessonDuration
            : 0;
          if (lessonPdfURL !== "") {
            data["lessonPdfURL"] = lessonPdfURL;
          }
          if (
            !req.files &&
            req.body.currentVideoURL &&
            req.files.editLessonVideo !== "null"
          ) {
            const errorMsg = editLessonDataValidator(data);
            if (errorMsg) throw errorMsg;
            if (data.lessonNumber /* || data.lessonTitle */) {
              const splitLessonURL = data.currentVideoURL.split("/");
              let fileName = splitLessonURL.at(-1);
              if (data.lessonNumber)
                fileName = fileName.replace(
                  lessonNumberReplaceRegex,
                  `(${data.lessonNumber})-`
                );
              // if (data.lessonTitle)
              //   fileName = fileName.replace(
              //     lessonTitleReplaceRegex,
              //     `-(${data.lessonTitle})-`
              //   );
              splitLessonURL.splice(-1, 1, fileName);
              const newLessonURL = splitLessonURL.join("/");
              const tempCurrentURLArray = data.currentVideoURL.split("/");
              const tempNewURLArray = newLessonURL.split("/");
              const OLD_KEY = tempCurrentURLArray
                .slice(tempCurrentURLArray.indexOf("courses"))
                .join("/");

              const NEW_KEY = tempNewURLArray
                .slice(tempCurrentURLArray.indexOf("courses"))
                .join("/");

              const RenameResult = await RenameObject(OLD_KEY, NEW_KEY);
              if (!RenameResult.success) throw RenameResult.error;
              if (RenameResult.success) data["lessonVideoURL"] = newLessonURL;
              lessonKey = NEW_KEY;
            }
          }
          if (
            !req.files &&
            req.body.currentPdfURL &&
            req.files.lessonPdf !== "null"
          ) {
            const errorMsg = editLessonDataValidator(data);
            if (errorMsg) throw errorMsg;
            if (data.lessonNumber /* || data.lessonTitle */) {
              const splitLessonURL = data.currentPdfURL.split("/");
              let fileName = splitLessonURL.at(-1);
              if (data.lessonNumber)
                fileName = fileName.replace(
                  lessonNumberReplaceRegex,
                  `(${data.lessonNumber})-`
                );
              // if (data.lessonTitle)
              //   fileName = fileName.replace(
              //     lessonTitleReplaceRegex,
              //     `-(${data.lessonTitle})-`
              //   );
              splitLessonURL.splice(-1, 1, fileName);
              const newLessonURL = splitLessonURL.join("/");
              const tempCurrentURLArray = data.currentPdfURL.split("/");
              const tempNewURLArray = newLessonURL.split("/");
              const OLD_KEY = tempCurrentURLArray
                .slice(tempCurrentURLArray.indexOf("courses"))
                .join("/");

              const NEW_KEY = tempNewURLArray
                .slice(tempCurrentURLArray.indexOf("courses"))
                .join("/");

              const RenameResult = await RenameObject(OLD_KEY, NEW_KEY);
              if (!RenameResult.success) throw RenameResult.error;
              if (RenameResult.success) data["lessonPdfURL"] = newLessonURL;
              lessonPdfKey = NEW_KEY;
            }
          }
          const course = await this.courseService.getCourseDetails(
            data.courseId
          );
          for (let lesson of course.courseLessonList) {
            if (
              lesson.lessonNumber.toString() === data.lessonNumber &&
              lesson._id.toString() !== req.body.lessonId
            ) {
              if (req.files?.editLessonVideo)
                lessonKey = req.file.editLessonVideo.key;
              if (req.files?.lessonPdf) lessonPdfKey = req.files.lessonPdf.key;
              throw "Lesson with same lesson number already exists";
            }
            if (
              lesson.lessonTitle === data.lessonTitle &&
              lesson._id.toString() !== req.body.lessonId
            ) {
              if (req.files?.editLessonVideo)
                lessonKey = req.file.editLessonVideo.key;
              if (req.files?.lessonPdf) lessonPdfKey = req.files.lessonPdf.key;
              throw "Lesson with same title already exists";
            }
          }
          if (!course) throw "Course doesn't exists";
          if (course.creatorId.toString() !== data.creatorId)
            throw "Course is not created by current user";
          const lessonExist = course.courseLessonList.some(
            (lesson) => lesson._id.toString() === data.lessonId
          );
          if (!lessonExist) throw "Lesson doesn't exists in given course";
          data["hasMoreLessons"] = course.hasMoreLessons;
          data["updatedAt"] = new Date();
          const updatedLesson = await this.courseService.updateLessonDetail(
            data
          );
          if (!updatedLesson) throw "Lesson editation failed";
          return Success(res, 200, "Lesson edited successfully", updatedLesson);
        } catch (error) {
          return CatchErrorHandler(
            res,
            error,
            "Editing of lesson",
            lessonKey,
            lessonPdfKey
          );
        }
      });
    } catch (error) {
      return CatchErrorHandler(res, error, "Editing of lesson");
    }
  }

  async deleteLesson(req, res) {
    try {
      const { _id: creatorId, courseId, lessonId } = req.body;
      const { role } = req.query;
      if (role !== "mentor") throw "Only mentor can delete course";
      const course = await this.courseService.getCourseDetails(courseId);
      if (!course) throw "Course doesn't exists";
      if (course.creatorId.toString() !== creatorId)
        throw "Course is not created by current user";
      const lesson = course.courseLessonList.find(
        (item) => item._id.toString() === lessonId
      );
      if (!lesson || isEmpty(lesson))
        throw "Course doesn't contain given lesson";
      const lessonKey = `courses${lesson.lessonVideoURL
        .split("courses")
        .at(-1)}`;
      const { Deleted, Errors } = await DeleteObjects([{ Key: lessonKey }]);
      if (Errors.length) throw Errors;
      if (!Deleted[0]?.Key) throw "No file is deleted on cloud";
      const data = {
        _id: courseId,
        lessonId,
        hasMoreLessons: course.hasMoreLessons,
      };
      const lessonDelete = await this.courseService.deleteLessonDetails(data);
      if (isEmpty(lessonDelete)) throw "Lesson deletion from record";
      return Success(res, 200, "Lesson Deleted Successfully", lessonDelete);
    } catch (error) {
      return CatchErrorHandler(res, error, "Lesson deletion");
    }
  }

  async addBadgeToCourse(req, res) {
    try {
      const {
        badgeTriggerId,
        badgeCourseId,
        role,
        badgeName,
        badgeDescription,
        _id,
      } = req.body;
      const { badgeId } = req.query;
      if (role !== "mentor") throw "Only mentor can add badges to course";
      const badgeTriggerCategoriesPromise = BadgeTriggersSchema.findOne(
        { _id: badgeTriggerId },
        "_id"
      );
      const coursePromise = this.courseService.getCourseDetails(badgeCourseId);
      const [badgeTriggerCategories, course] = await Promise.all([
        badgeTriggerCategoriesPromise,
        coursePromise,
      ]);
      if (!badgeTriggerCategories)
        throw "Invalid badge trigger category or trigger id";
      if (!course) throw "Course doesn't exits";
      if (course.creatorId.toString() !== _id)
        throw "Course is not created by current user";
      for (let badge of course.courseBadgesList) {
        if (badge.isDeleted) continue;
        if (badge.badgeName === badgeName)
          throw "Badge with same name already exists";
        if (badgeTriggerId === badge.badgeTriggerId?.toString())
          throw "Badge with same trigger is already created";
      }
      const data = {
        badgeDetails: {
          _id: Types.ObjectId(badgeId),
          badgeName,
          badgeDescription,
          badgeTriggerId: Types.ObjectId(badgeTriggerId),
          badgeCreatorId: Types.ObjectId(_id),
          badgeCourseId: Types.ObjectId(badgeCourseId),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        },
        badgesCount: course.badgesCount,
      };
      let { result, data: badgeData } =
        await BadgeService.addBadgeToCourseService(data);
      if (!result) throw badgeData;
      badgeData = badgeData.courseBadgesList.filter((item) => {
        return item.isDeleted === false;
      });
      return Success(res, 200, "Badge added successfully", badgeData);
    } catch (error) {
      return CatchErrorHandler(res, error, "Badge addition to course");
    }
  }

  async editCourseBadge(req, res) {
    try {
      const {
        role,
        badgeTriggerId,
        badgeCourseId,
        _id,
        badgeId,
        badgeName,
        badgeDescription,
      } = req.body;
      if (role !== "mentor") throw "Only mentor can delete badge from course";
      const badgeTriggerCategoriesPromise = BadgeTriggersSchema.findOne(
        { _id: badgeTriggerId },
        "_id"
      );
      const coursePromise = this.courseService.getCourseDetails(badgeCourseId);
      const [badgeTriggerCategories, course] = await Promise.all([
        badgeTriggerCategoriesPromise,
        coursePromise,
      ]);
      if (!badgeTriggerCategories)
        throw "Invalid badge trigger category or trigger id";
      if (!course) throw "Course doesn't exits";
      if (course.creatorId.toString() !== _id)
        throw "Course is not created by current user";
      let alreadyUsedBadgeTrigger = false,
        alreadyUsedBadgeName = false;
      for (let badge of course.courseBadgesList) {
        if (alreadyUsedBadgeTrigger && alreadyUsedBadgeName) break;
        if (badge._id.toString() === badgeId) continue;
        if (!alreadyUsedBadgeTrigger)
          alreadyUsedBadgeTrigger =
            !badge.isDeleted &&
            badge.badgeTriggerId.toString() === badgeTriggerId;
        if (!alreadyUsedBadgeName)
          alreadyUsedBadgeName =
            !badge.isDeleted && badgeName === badge.badgeName;
      }
      if (alreadyUsedBadgeTrigger)
        throw "Another badge with same trigger already exists";
      if (alreadyUsedBadgeName)
        throw "Another badge with same name already exists";
      const currentBadgeDetails = course.courseBadgesList.find(
        (item) => item._id.toString() === badgeId
      );
      const badgeData = {
        ...currentBadgeDetails._doc,
        badgeName,
        badgeDescription,
        badgeTriggerId,
        updatedAt: new Date(),
      };
      const { result, data } = await BadgeService.editCourseBadgeService(
        badgeData
      );
      if (!result) throw data;
      return Success(
        res,
        200,
        "Badge edited successfully",
        isEmpty(data) ? {} : data.courseBadgesList
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Badge edition to course");
    }
  }

  async addQuestionsToCourse(req, res) {
    try {
      const { courseId, _id: creatorId, courseQuestions } = req.body;
      courseQuestions.forEach((item) => {
        item.createdAt = new Date();
      });
      const course = await this.courseService.getCourseDetails(courseId, false);
      if (course.creatorId.toString() !== creatorId)
        throw "Course doesn't belongs to given user";
      const recordData = {
        _id: courseId,
        courseQuestions,
      };
      const { result, data } = await this.courseService.addQuestionsInDB(
        recordData
      );
      if (!result) throw data;
      return Success(res, 200, "Questions added successfully");
    } catch (error) {
      return CatchErrorHandler(res, error, "Question addtion to course");
    }
  }

  async userCourseRatePermission(req, res) {
    try {
      const { courseId, ratingAllowed, _id: creatorId, role } = req.body;
      if (role !== "mentor")
        throw "Only mentor can set permission for rating visibility";
      const course = await this.courseService.getCourseDetails(courseId, false);
      if (course.creatorId.toString() !== creatorId)
        throw "Course is not created by current user";
      const recordData = {
        courseId,
        ratingAllowed,
      };
      const { result, data } = await this.courseService.changeRatingPermission(
        recordData
      );
      if (!result) throw data;
      return Success(res, 200, "User rating permisson changed successfully");
    } catch (error) {
      return CatchErrorHandler(
        res,
        error,
        "User course rate permission addition"
      );
    }
  }

  async sendCourseForApproval(req, res) {
    try {
      const { courseId, _id: creatorId } = req.body;
      const course = await this.courseService.getCourseDetails(courseId, false);
      if (course.creatorId.toString() !== creatorId)
        throw "Course is not created by current user";
      const { result, data } = await this.courseService.sendCourseForApproval(
        courseId
      );
      if (!result) throw data;
      return Success(res, 200, "User rating permisson changed successfully");
    } catch (error) {
      return CatchErrorHandler(
        res,
        error,
        "Sending course for approval to admin"
      );
    }
  }

  async deleteCourseBadge(req, res) {
    try {
      const { courseId, badgeId, _id, role } = req.body;
      if (role !== "mentor") throw "Only mentor can delete badge from course";
      const course = await this.courseService.getCourseDetails(courseId);
      if (!course) throw "Course doesn't exists";
      if (course.creatorId.toString() !== _id)
        throw "Course is not created by current user";
      const badgeExistsInCourse = course.courseBadgesList.some(
        (badge) => badge._id.toString() === badgeId
      );
      if (!badgeExistsInCourse) throw "Badge doesn't exists in given course";
      const { result, data } = await BadgeService.deleteCourseBadgeService({
        courseId,
        badgeId,
      });
      if (!result) throw data;
      return Success(
        res,
        200,
        "Badge deleted successfully",
        isEmpty(data) ? {} : { badgeId }
      );
    } catch (error) {
      return CatchErrorHandler(res, error, "Deletion of course badge");
    }
  }
}

module.exports = new MentorController(MentorUserService);
