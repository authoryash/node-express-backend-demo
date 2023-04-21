const { Service } = require("../../system/services/Service");
const autoBind = require("auto-bind");
const {
  CoursesSchema,
  UserCourseProgressSchema,
  OutlierCourseBadgesSchema,
  BadgeTriggersSchema,
} = require("../models/index.models");
const { Types } = require("mongoose");
const { badgesArrayLengthLimit } = require("../constants/app.constants");

class BadgeService extends Service {
  constructor() {
    super();
    this.courseModel = CoursesSchema;
    this.outlierBadgesModel = OutlierCourseBadgesSchema;
    this.userCourseProgressModel = UserCourseProgressSchema;
    autoBind(this);
  }

  async getUserBadgesTitles({ _id, role, courseId }) {
    try {
      _id = Types.ObjectId(_id);
      courseId = Types.ObjectId(courseId);
      let model = null;
      let findParam = null;
      if (role === "mentor") {
        model = this.courseModel;
        findParam = { _id: courseId, creatorId: _id, isItApproved: true };
      } else {
        model = this.userCourseProgressModel;
        findParam = { userId: _id, courseId };
      }
      const [getBadgesTitles] = await model.aggregate([
        { $match: findParam },
        {
          $project: {
            badgeList:
              role === "mentor" ? "$courseBadgesList" : "$earnedBadges",
          },
        },
      ]);
      return { result: true, data: getBadgesTitles };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async addBadgeToCourseService(data) {
    const { badgeDetails, badgesCount } = data;
    const { badgeCourseId } = badgeDetails;
    let addBadgeToCourseDoc = null;
    try {
      if (badgesCount < badgesArrayLengthLimit) {
        addBadgeToCourseDoc = await this.courseModel.findOneAndUpdate(
          {
            $and: [
              { _id: badgeCourseId },
              { badgesCount: { $lt: badgesArrayLengthLimit } },
            ],
          },
          [
            {
              $set: {
                courseBadgesList: {
                  $concatArrays: ["$courseBadgesList", [badgeDetails]],
                },
                badgesCount: {
                  $add: ["$badgesCount", 1],
                },
              },
            },
            {
              $set: {
                hasMoreBadges: {
                  $cond: [
                    { $eq: ["$hasMoreBadges", true] },
                    true,
                    {
                      $cond: [
                        { $gte: ["$badgesCount", badgesArrayLengthLimit] },
                        true,
                        false,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          {
            new: true,
          }
        );
      }
      if (!addBadgeToCourseDoc) {
        addBadgeToCourseDoc = await this.outlierBadgesModel.findOneAndUpdate(
          {
            $and: [
              { courseId: badgeCourseId },
              { badgesCount: { $lt: badgesArrayLengthLimit } },
            ],
          },
          {
            $push: {
              courseBadgesList: badgeDetails,
            },
            $inc: {
              badgesCount: 1,
            },
          },
          {
            new: true,
            upsert: true,
          }
        );
      }
      return { result: true, data: addBadgeToCourseDoc };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async editCourseBadgeService(badgeData) {
    try {
      let updateBadge = null;
      updateBadge = await this.courseModel.findOneAndUpdate(
        {
          _id: badgeData.badgeCourseId,
          "courseBadgesList._id": badgeData._id,
        },
        { $set: { "courseBadgesList.$": badgeData } },
        {
          projection: {
            courseBadgesList: {
              $filter: {
                input: "$courseBadgesList",
                as: "courseBadgesList",
                cond: { $eq: ["$$courseBadgesList.isDeleted", false] },
              },
            },
          },
        }
      );
      if (!updateBadge) {
        updateBadge = await this.outlierBadgesModel.findOneAndUpdate(
          {
            courseId: badgeData.badgeCourseId,
            "courseBadgesList._id": badgeData._id,
          },
          { $set: { "courseBadgesList.$": badgeData } },
          {
            projection: {
              courseBadgesList: {
                $filter: {
                  input: "$courseBadgesList",
                  as: "courseBadgesList",
                  cond: { $eq: ["$$courseBadgesList.isDeleted", false] },
                },
              },
            },
          }
        );
      }
      return { result: true, data: updateBadge };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async deleteCourseBadgeService({ courseId, badgeId }) {
    try {
      let deleteBadge = null;
      deleteBadge = await this.courseModel.findOneAndUpdate(
        {
          _id: courseId,
          "courseBadgesList._id": badgeId,
        },
        { $set: { "courseBadgesList.$.isDeleted": true } },
        { new: true }
      );
      if (!deleteBadge) {
        deleteBadge = await this.outlierBadgesModel.findOneAndUpdate(
          {
            courseId,
            "courseBadgesList._id": badgeId,
          },
          { $set: { "courseBadgesList.$.isDeleted": true } },
          { new: true }
        );
      }
      return { result: true, data: deleteBadge };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async getBadgeTriggers() {
    try {
      const badgeTriggerPromise = await BadgeTriggersSchema.find({});
      return { result: true, data: badgeTriggerPromise };
    } catch (error) {
      return { result: false, data: error };
    }
  }
}

module.exports = new BadgeService();
