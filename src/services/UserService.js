"use strict";
const { Service } = require("../../system/services/Service");
const autoBind = require("auto-bind");
const {
  FollowersListSchema,
  WellnessCategoriesSchema,
  PostDetailSchema,
  UserCourseProgressSchema,
  CoursesSchema,
} = require("../models/index.models");
const { startSession } = require("mongoose");
const { isEmpty } = require("lodash");
const { Types } = require("mongoose");
const {
  postPerPageLimit,
  feedPostDaySlabIncrease,
  feedPostCounts,
  feedMaxDayLimit,
  mentorPerDiscoverQuery,
  mentionPerQueryLimit,
  memberUserTable,
  mentorUserTable,
  postDetailsTable,
  courseTable,
} = require("../constants/index.constants");
const { getSamplePostList } = require("./PostDetailservice");
const { getSampleCourseList } = require("./CourseService");
const { getSampleMentorsList } = require("./MentorUserService");
const { addDaysToDate } = require("../helpers/date-conversion");

class UserService extends Service {
  constructor(model, mentorModel) {
    super(model, mentorModel);
    this.model = model;
    this.mentorModel = mentorModel;
    this.postModel = PostDetailSchema;
    this.progressModel = UserCourseProgressSchema;
    this.courseModel = CoursesSchema;
    autoBind(this);
  }

  async findUserOne(findParam) {
    return this.model.findOne(findParam);
  }

  async updateProfile(_id, role, data) {
    if (role === "member")
      return this.model.findOneAndUpdate({ _id }, data, { new: true });
    if (role === "mentor")
      return this.mentorModel.findOneAndUpdate({ _id }, data, { new: true });
    return null;
  }

  async getRecommendedMentorList({ _id, categories, pageNumber = 0 }) {
    return this.mentorModel.aggregate([
      {
        $addFields: {
          commonCount: {
            $size: {
              $setIntersection: ["$wellnessCategories._id", categories],
            },
          },
        },
      },
      { $match: { commonCount: { $gte: 1 } } },
      {
        $lookup: {
          from: "followerslists",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                followerId: Types.ObjectId(_id),
                $expr: { $eq: ["$influencerId", "$$userId"] },
                influencerRole: "mentor",
                currentFollowStatus: true,
              },
            },
          ],
          as: "followingUser",
        },
      },
      { $match: { followingUser: [] } },
      { $sort: { followers: -1 } },
      { $skip: mentorPerDiscoverQuery * pageNumber },
      { $limit: mentorPerDiscoverQuery },
      {
        $project: {
          _id: 1,
          profilePic: 1,
          wellnessRole: 1,
          name: 1,
          userName: 1,
        },
      },
    ]);
  }

  async getProfileBuilderData(_id) {
    return this.mentorModel.findOne({ _id }, "tags wellnessCategories bio");
  }

  async setProfileBuilderData(_id, tags, wellnessCategories) {
    return this.mentorModel.findOneAndUpdate(
      { _id },
      { tags, wellnessCategories },
      { new: true }
    );
  }

  async getProfileData(_id, role) {
    try {
      let fieldString =
        "_id name email bio role wellnessGoal followers following badges profilePic phoneNumber wellnessCategories postSaved FCMToken";
      let data;
      if (role === "member")
        data = await this.model.findOne(
          { _id },
          `${fieldString} userName progressBar`
        );
      else if (role === "mentor")
        data = await this.mentorModel.findOne(
          { _id },
          `${fieldString} userName wellnessRole tags postSaved`
        );
      return { result: true, data };
    } catch (error) {
      let errorMsg;
      if (error.name === "CastError") errorMsg = "Invalid id";
      return { result: false, data: errorMsg ?? error };
    }
  }

  async createFollower(followerId, influencerId, influencerRole, followerRole) {
    const session = await startSession();
    session.startTransaction();
    try {
      const followUserExist = await FollowersListSchema.findOne({
        followerId,
        influencerId,
        influencerRole,
        followerRole,
      });
      let followerUser;
      if (followUserExist) {
        followerUser = await FollowersListSchema.findOneAndUpdate(
          {
            followerId,
            influencerId,
            influencerRole,
            followerRole,
          },
          [
            {
              $set: {
                currentFollowStatus: { $eq: ["$currentFollowStatus", false] },
              },
            },
          ],
          {
            session,
            upsert: true,
            new: true,
          }
        );
      } else {
        followerUser = await FollowersListSchema.create({
          followerId,
          influencerId,
          influencerRole,
          followerRole,
        });
      }
      if (isEmpty(followerUser)) throw "Follower record insertation failed";
      let influcerModel = null;
      if (influencerRole === "member") influcerModel = this.model;
      if (influencerRole === "mentor") influcerModel = this.mentorModel;
      const followerIncrease = await influcerModel.findByIdAndUpdate(
        influencerId,
        {
          $inc: {
            followers: followerUser.currentFollowStatus === true ? 1 : -1,
          },
        },
        { session, new: true }
      );
      if (isEmpty(followerIncrease)) throw "Follower count updation failed";
      let followerModel = null;
      if (followerRole === "member") followerModel = this.model;
      if (followerRole === "mentor") followerModel = this.mentorModel;
      const followingIncrease = await followerModel.findByIdAndUpdate(
        followerId,
        {
          ...(followerRole === "member" && { isRecommendationComplete: true }),
          $inc: {
            following: followerUser.currentFollowStatus === true ? 1 : -1,
          },
        },
        { session, new: true }
      );
      if (isEmpty(followingIncrease))
        throw "Following count and recommendation completion status updation failed";
      await session.commitTransaction();
      session.endSession();
      return { result: true, data: followerUser };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      let errorMsg;
      if (error.name === "MongoError" && error.code === 11000)
        errorMsg = "User is already a follower";
      return { result: false, data: errorMsg ?? error };
    }
  }

  async getFollowingList(_id) {
    try {
      const getFollowingList = await FollowersListSchema.find(
        {
          influencerId: _id,
          currentFollowStatus: true,
          followerRole: "member",
        },
        "followerId"
      );

      return { result: true, data: getFollowingList };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getWellnessCategories() {
    try {
      const wellnessCategories = await WellnessCategoriesSchema.find({});
      wellnessCategories.sort((a, b) => a.priorityNumber - b.priorityNumber);
      return { result: true, data: wellnessCategories };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async updateWellnessCategories(_id, wellnessCategories, role) {
    try {
      let model = "";
      if (role === "member") model = this.model;
      if (role === "mentor") model = this.mentorModel;
      const updatedWellnessCategories = await model.findByIdAndUpdate(
        _id,
        {
          wellnessCategories,
        },
        { new: true }
      );
      return { result: true, updatedWellnessCategories };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async savePost(_id, data, role) {
    try {
      let model = "";
      if (role === "member") model = this.model;
      if (role === "mentor") model = this.mentorModel;

      const res = await model.findByIdAndUpdate(
        _id,
        {
          postSaved: data,
        },
        { new: true, select: "_id" }
      );

      return { result: true, data: res };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async searchMentor({ value, _id, pageNumber }) {
    try {
      const searchKey = value;
      const getdata = await this.mentorModel.aggregate([
        {
          $match: {
            _id: { $ne: Types.ObjectId(_id) },
            $or: [
              { name: { $regex: `^(?i)${searchKey}` } },
              { userName: { $regex: `^(?i)${searchKey}` } },
            ],
          },
        },
        {
          $lookup: {
            from: "followerslists",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $and: [
                    {
                      $or: [
                        { $expr: { $eq: ["$followerId", "$$userId"] } },
                        { $expr: { $eq: ["$influencerId", "$$userId"] } },
                      ],
                    },
                    {
                      $or: [
                        {
                          $expr: {
                            $eq: ["$influencerId", Types.ObjectId(_id)],
                          },
                        },
                        {
                          $expr: {
                            $eq: ["$followerId", Types.ObjectId(_id)],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            as: "following",
          },
        },
        { $skip: mentorPerDiscoverQuery * pageNumber },
        { $limit: mentorPerDiscoverQuery },
        {
          $project: {
            name: 1,
            userName: 1,
            profilePic: 1,
            isFollowed: {
              $cond: [{ $ne: [{ $size: "$following" }, 0] }, true, false],
            },
            wellnessRole: 1,
          },
        },
      ]);

      return { result: true, getdata };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async searchUser({ value, _id, pageNumber }) {
    try {
      const searchKey = value;

      const getdata = await this.model.aggregate([
        {
          $match: {
            _id: { $ne: Types.ObjectId(_id) },
            $or: [
              { name: { $regex: `^(?i)${searchKey}` } },
              { userName: { $regex: `^(?i)${searchKey}` } },
            ],
          },
        },
        {
          $lookup: {
            from: "followerslists",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $and: [
                    {
                      $or: [
                        { $expr: { $eq: ["$followerId", "$$userId"] } },
                        { $expr: { $eq: ["$influencerId", "$$userId"] } },
                      ],
                    },
                    {
                      $or: [
                        {
                          $expr: {
                            $eq: ["$influencerId", Types.ObjectId(_id)],
                          },
                        },
                        {
                          $expr: {
                            $eq: ["$followerId", Types.ObjectId(_id)],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            as: "following",
          },
        },
        { $skip: mentorPerDiscoverQuery * pageNumber },
        { $limit: mentorPerDiscoverQuery },
        {
          $project: {
            name: 1,
            userName: 1,
            profilePic: 1,
            isFollowed: {
              $cond: [{ $ne: [{ $size: "$following" }, 0] }, true, false],
            },
          },
        },
      ]);
      return { result: true, getdata };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getMemberDashBoardDataService(_id) {
    try {
      const [userData] = await this.model.aggregate([
        { $match: { _id: Types.ObjectId(_id) } },
        { $limit: 1 },
        {
          $lookup: {
            from: postDetailsTable,
            localField: "_id",
            foreignField: "userId",
            let: { savedDetails: "$postSaved" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$isDeleted", false] },
                },
              },
              {
                $lookup: {
                  from: courseTable,
                  let: {
                    courseID: { $first: "$linkedCourse" },
                    badgeID: { $first: "$linkedBadge" },
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$_id", "$$courseID"],
                        },
                      },
                    },
                    { $unwind: "$courseBadgesList" },
                    {
                      $match: {
                        $expr: {
                          $eq: ["$courseBadgesList._id", "$$badgeID"],
                        },
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        courseTitle: 1,
                        badgeName: {
                          $cond: [
                            { $ne: ["$courseBadgesList.badgeName", ""] },
                            "$courseBadgesList.badgeName",
                            "",
                          ],
                        },
                      },
                    },
                  ],
                  as: "linkedCourses",
                },
              },
              {
                $lookup: {
                  from: memberUserTable,
                  localField: "usersMentions",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        userName: 1,
                        role: 1,
                        name: 1,
                      },
                    },
                  ],
                  as: "usersMentionsMember",
                },
              },
              {
                $lookup: {
                  from: mentorUserTable,
                  localField: "usersMentions",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        userName: 1,
                        role: 1,
                        name: 1,
                      },
                    },
                  ],
                  as: "usersMentionsMentor",
                },
              },
              {
                $addFields: {
                  liked: { $in: [{ $toString: "$userId" }, "$userLiked"] },
                  saved: { $in: [{ $toString: "$_id" }, "$$savedDetails"] },
                  userDetails: { $first: "$userDetails" },
                  linkedCourse: { $first: "$linkedCourses.courseTitle" },
                  linkedBadge: { $first: "$linkedCourses.badgeName" },
                  usersMentions: {
                    $concatArrays: [
                      "$usersMentionsMember",
                      "$usersMentionsMentor",
                    ],
                  },
                },
              },
              {
                $project: {
                  linkedCourses: 0,
                  usersMentionsMentor: 0,
                  usersMentionsMember: 0,
                  userLiked: 0,
                  isDeleted: 0,
                  badges: 0,
                  userId: 0,
                },
              },
              // { $match: { userLiked: { $ne: [] } } },
              { $sort: { createdAt: -1 } },
              { $limit: postPerPageLimit },
            ],
            as: "userPosts",
          },
        },
        {
          $project: {
            _id: 0,
            wellnessCategories: 1,
            userPosts: 1,
            name: 1,
            userName: 1,
          },
        },
      ]);
      return { result: true, data: userData };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getPostListService(data) {
    const { userId = null, pageNumber = 0, _id = null } = data;
    try {
      const postList = await this.postModel.aggregate([
        { $match: { userId: Types.ObjectId(userId ?? _id), isDeleted: false } },
        { $sort: { createdAt: -1 } },
        { $skip: postPerPageLimit * pageNumber },
        { $limit: postPerPageLimit },
        {
          $lookup: {
            from: memberUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [{ $project: { postSaved: 1, _id: 0 } }],
            as: "postDetails",
          },
        },
        {
          $addFields: {
            likeCounts: { $size: "$userLiked" },
            liked: { $in: [{ $toString: "$userId" }, "$userLiked"] },
            saved: {
              $in: [
                { $toString: "$_id" },
                { $first: "$postDetails.postSaved" },
              ],
            },
          },
        },
        {
          $project: {
            userLiked: 0,
            isDeleted: 0,
            postDetails: 0,
          },
        },
      ]);
      return { result: true, data: postList };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getExploreDataService({ _id, role }) {
    try {
      let mentorList = await FollowersListSchema.find(
        { followerId: _id, currentFollowStatus: true },
        "influencerId -_id"
      );
      mentorList = mentorList.map((item) => item.influencerId);
      const { result: postResult, data: postData } = await getSamplePostList({
        _id,
        mentorList,
      });
      if (!postResult) throw postData;
      const { result: courseResult, data: courseData } =
        await getSampleCourseList({ _id, role });
      if (!courseResult) throw courseData;
      const { result: mentorResult, data: mentorData } =
        await getSampleMentorsList({
          mentorList,
          size: mentorPerDiscoverQuery,
        });
      if (!mentorResult) throw mentorData;
      let data = {};
      if (role === "member") {
        data = { postData, courseData, mentorData };
      } else {
        data = { postData, mentorData };
      }
      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getFeedPostsService({
    _id,
    getPostsOf,
    alreadyFetchedPostsId = [],
    // role,
  } = {}) {
    try {
      let getFeedPosts = [];
      let getInfluencerIds = await FollowersListSchema.find(
        {
          followerId: _id,
          influencerRole: getPostsOf,
          currentFollowStatus: true,
        },
        "influencerId -_id"
      );
      alreadyFetchedPostsId = alreadyFetchedPostsId.map((item) =>
        Types.ObjectId(item)
      );
      getInfluencerIds = getInfluencerIds.map((item) => item.influencerId);
      let maxDate = new Date();
      let minDate = addDaysToDate(new Date(), -1 * feedPostDaySlabIncrease);
      const terminateDate = addDaysToDate(new Date(), -1 * feedMaxDayLimit);
      while (getFeedPosts.length < feedPostCounts) {
        const getFeedPostsFromDB = await this.postModel.aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $gt: ["$createdAt", minDate],
                  },
                  { $lte: ["$createdAt", maxDate] },
                  { $in: ["$userId", getInfluencerIds] },
                  {
                    $not: { $in: ["$_id", alreadyFetchedPostsId] },
                  },
                  {
                    $eq: ["$isDeleted", false],
                  },
                ],
              },
            },
          },
          { $match: { $expr: { $gt: ["$createdAt", terminateDate] } } },
          {
            $lookup: {
              from: getPostsOf === "mentor" ? mentorUserTable : memberUserTable,
              let: { userId: "$userId" },
              pipeline: [
                {
                  $match: { $expr: { $eq: ["$_id", "$$userId"] } },
                },
                {
                  $project: {
                    _id: 1,
                    profilePic: 1,
                    wellnessRole: 1,
                    postSaved: 1,
                    userName: 1,
                  },
                },
              ],
              as: "userDetails",
            },
          },
          {
            $lookup: {
              from: courseTable,
              let: {
                courseID: { $first: "$linkedCourse" },
                badgeID: { $first: "$linkedBadge" },
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$_id", "$$courseID"],
                    },
                  },
                },
                { $unwind: "$courseBadgesList" },
                {
                  $match: {
                    $expr: {
                      $eq: ["$courseBadgesList._id", "$$badgeID"],
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    courseTitle: 1,
                    badgeName: {
                      $cond: [
                        { $ne: ["$courseBadgesList.badgeName", ""] },
                        "$courseBadgesList.badgeName",
                        "",
                      ],
                    },
                  },
                },
              ],
              as: "linkedCourses",
            },
          },
          {
            $lookup: {
              from: memberUserTable,
              localField: "usersMentions",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    userName: 1,
                    role: 1,
                    name: 1,
                  },
                },
              ],
              as: "usersMentionsMember",
            },
          },
          {
            $lookup: {
              from: mentorUserTable,
              localField: "usersMentions",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    userName: 1,
                    role: 1,
                    name: 1,
                  },
                },
              ],
              as: "usersMentionsMentor",
            },
          },
          {
            $addFields: {
              liked: { $in: [_id, "$userLiked"] },
              userDetails: { $first: "$userDetails" },
              linkedCourse: { $first: "$linkedCourses.courseTitle" },
              linkedBadge: { $first: "$linkedCourses.badgeName" },
              usersMentions: {
                $concatArrays: ["$usersMentionsMember", "$usersMentionsMentor"],
              },
            },
          },
          {
            $project: {
              linkedCourses: 0,
              usersMentionsMentor: 0,
              usersMentionsMember: 0,
            },
          },
          { $sample: { size: feedPostCounts - getFeedPosts.length } },
        ]);
        getFeedPostsFromDB.forEach((item) => {
          return getFeedPosts.push(item);
        });
        if (minDate <= terminateDate) break;
        minDate = addDaysToDate(minDate, -1 * feedPostDaySlabIncrease);
        maxDate = addDaysToDate(maxDate, -1 * feedPostDaySlabIncrease);
      }
      return { result: true, data: getFeedPosts };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async findUsersService({ userName, alreadyFetchedUsersIdObjects }) {
    try {
      const aggregation = [
        {
          $match: {
            userName: { $regex: `^${userName}` },
            _id: { $nin: alreadyFetchedUsersIdObjects },
          },
        },
        { $sample: { size: mentionPerQueryLimit } },
        { $project: { userName: 1, name: 1, profilePic: 1 } },
      ];
      const findUsersPromise = this.model.aggregate(aggregation);
      const findMentorsPromise = this.mentorModel.aggregate(aggregation);
      const [findUsers, findMentors] = await Promise.all([
        findUsersPromise,
        findMentorsPromise,
      ]);
      const randomiseArray = [...findUsers, ...findMentors]
        .map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
      return { result: true, data: randomiseArray };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async updateProgressBarService({ _id, totalWeightage, badgeCount }) {
    await this.model.findOneAndUpdate(
      { _id },
      { $inc: { progressBar: totalWeightage, badges: badgeCount } },
      { new: true }
    );
  }
  async getEnrolledCourses({ userId, courseId }) {
    try {
      const data = await this.model.find({
        _id: Types.ObjectId(userId),
        enrolledCourses: { $elemMatch: { $eq: courseId } },
      });
      return { resultc: true, courseSignup: data };
    } catch (error) {
      return { resultc: false, courseSignup: error };
    }
  }
  async getEarnedBadges({ _id }) {
    try {
      const data = await this.progressModel.aggregate([
        {
          $match: {
            userId: Types.ObjectId(_id),
          },
        },
        {
          $group: {
            _id: "$userId",
            badges: {
              $push: "$earnedBadges.badgeId",
            },
          },
        },
      ]);
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async getEarnedBadgesDetails({ badgeArray }) {
    badgeArray = badgeArray.map((item) => {
      return Types.ObjectId(item);
    });

    try {
      const data = await this.courseModel.aggregate([
        {
          $match: {
            "courseBadgesList._id": {
              $in: [...badgeArray],
            },
          },
        },
        {
          $project: {
            courseBadgeList: {
              $filter: {
                input: "$courseBadgesList",
                as: "courseBadgesList",
                cond: {
                  $in: ["$$courseBadgesList._id", badgeArray],
                },
              },
            },
          },
        },
        {
          $match: {
            courseBadgeList: {
              $ne: [],
            },
          },
        },
        // {
        //   $replaceRoot: {
        //     newRoot: { $mergeObjects: ["$$ROOT.courseBadgeList"] },
        //   },
        // },
        {
          $project: {
            _id: 0,
            courseBadgeList: 1,
          },
        },
      ]);
      console.log(
        "🚀 ~ file: UserService.js:919 ~ UserService ~ getEarnedBadgesDetails ~ data",
        data
      );
      return { badgeResult: true, badgeData: data };
    } catch (error) {
      return { badgeResult: false, badgeData: error };
    }
  }
  async getFCMToken(ids) {
    console.log(
      "🚀 ~ file: UserService.js:939 ~ UserService ~ getFCMToken ~ ids",
      ids
    );
    try {
      const data = await this.model.aggregate([
        {
          $match: {
            _id: {
              $in: [...ids],
            },
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
      console.log(
        "🚀 ~ file: UserService.js:962 ~ UserService ~ getFCMToken ~ data",
        data
      );

      return data;
    } catch (error) {
      return error;
    }
  }
}

module.exports = { UserService };
