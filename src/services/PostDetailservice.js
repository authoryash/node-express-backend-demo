"use strict";
const { Service } = require("../../system/services/Service");
const autoBind = require("auto-bind");
const { PostDetailSchema } = require("../models/index.models");
const { User } = require("../models/User");
const MentorUser = require("./../models/MentorUser");
const { isEmpty } = require("lodash");
const {
  postPerDiscoverQuery,
  postPerPageLimit,
  mentorUserTable,
  memberUserTable,
  courseTable,
} = require("../constants/index.constants");
const { Types } = require("mongoose");
class PostDetailService extends Service {
  constructor(model) {
    super(model);
    this.model = PostDetailSchema;
    autoBind(this);
  }

  async createPostDetails(data) {
    try {
      const datacreated = await PostDetailSchema.create(data);
      if (isEmpty(datacreated)) throw "Follower record insertation failed";
      return { result: true, data: datacreated };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getPostDetails(_id, callByUser = false, pageNumber = 0) {
    try {
      let match =
        callByUser != "true"
          ? { _id: Types.ObjectId(_id), isDeleted: false }
          : { userId: Types.ObjectId(_id), isDeleted: false };
      const data = await PostDetailSchema.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: postPerPageLimit * pageNumber },
        { $limit: postPerPageLimit },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                  FCMToken: 1,
                  role: 1,
                },
              },
            ],
            as: "mentor",
          },
        },
        {
          $lookup: {
            from: memberUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                  FCMToken: 1,
                  role: 1,
                },
              },
            ],
            as: "user",
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
            creatorDetails: {
              $cond: [{ $ne: ["$mentor", []] }, "$mentor", "$user"],
            },
            linkedCourse: { $first: "$linkedCourses.courseTitle" },
            linkedBadge: { $first: "$linkedCourses.badgeName" },
            usersMentions: {
              $concatArrays: ["$usersMentionsMember", "$usersMentionsMentor"],
            },
          },
        },
        {
          $project: {
            mentor: 0,
            user: 0,
            linkedCourses: 0,
            usersMentionsMentor: 0,
            usersMentionsMember: 0,
          },
        },
      ]);
      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async getSavedPostDetails({ savedPosts, pageNumber }) {
    try {
      let postSaved = savedPosts.map((item) => {
        return Types.ObjectId(item);
      });

      const data = await PostDetailSchema.aggregate([
        {
          $match: {
            isDeleted: false,
            ...(postSaved.length && {
              _id: {
                $in: [...postSaved],
              },
            }),
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: postPerPageLimit * pageNumber },
        { $limit: postPerPageLimit },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                  role: 1,
                },
              },
            ],
            as: "mentor",
          },
        },
        {
          $lookup: {
            from: memberUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                  role: 1,
                },
              },
            ],
            as: "user",
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
            creatorDetails: {
              $cond: [{ $ne: ["$mentor", []] }, "$mentor", "$user"],
            },
            linkedCourse: { $first: "$linkedCourses.courseTitle" },
            linkedBadge: { $first: "$linkedCourses.badgeName" },
            usersMentions: {
              $concatArrays: ["$usersMentionsMember", "$usersMentionsMentor"],
            },
          },
        },
        {
          $project: {
            mentor: 0,
            user: 0,
            linkedCourses: 0,
            usersMentionsMentor: 0,
            usersMentionsMember: 0,
          },
        },
      ]);
      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getPostDetailsByUserId(_id) {
    try {
      const data = await PostDetailSchema.findById({ _id, isDeleted: false });

      return { result: true, data };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async postLiked(_id, data) {
    try {
      let postdata = await PostDetailSchema.findByIdAndUpdate(
        _id,
        {
          userLiked: data,
        },
        { new: true }
      );
      let count = postdata.userLiked.length;
      postdata = await PostDetailSchema.findByIdAndUpdate(
        _id,
        {
          likeCount: count,
        },
        { new: true }
      );
      return { result: true, postdata };
    } catch (error) {
      return { result: false, data: error };
    }
  }

  async getSamplePostList({
    _id,
    mentorList = [],
    alreadyFetchedPostsId = null,
  } = {}) {
    try {
      let _idObj = Types.ObjectId(_id);
      mentorList.push(_idObj);
      const samplePosts = await this.model.aggregate([
        {
          $match: {
            userId: {
              $nin: mentorList,
            },
            ...(alreadyFetchedPostsId && {
              _id: { $nin: alreadyFetchedPostsId },
            }),
            isDeleted: false,
            userLiked: { $not: { $elemMatch: { $eq: _id } } },
            usersMention: { $not: { $elemMatch: { $eq: _id } } },
          },
        },
        { $sample: { size: postPerDiscoverQuery } },
        {
          $lookup: {
            from: memberUserTable,
            pipeline: [
              { $match: { _id: _idObj } },
              {
                $project: {
                  postSaved: 1,
                },
              },
            ],
            as: "userDetails",
          },
        },
        {
          $match: {
            _id: {
              $nin: ["$_id", "$userDetails.postSaved"],
            },
          },
        },
        { $project: { userDetails: 0 } },
        {
          $lookup: {
            from: mentorUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                },
              },
            ],
            as: "creatorMentorDetails",
          },
        },
        {
          $lookup: {
            from: memberUserTable,
            localField: "userId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  name: 1,
                  wellnessRole: 1,
                  profilePic: 1,
                  userName: 1,
                },
              },
            ],
            as: "creatorUserDetails",
          },
        },
        {
          $lookup: {
            from: courseTable,
            let: {
              courseID: { $first: "$linkedCourse" },
              badgeID: {
                $cond: [
                  { $ne: ["$linkedBadge", ""] },
                  { $first: "$linkedBadge" },
                  "",
                ],
              },
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
            creatorDetails: {
              $cond: [
                { $ne: ["$creatorMentorDetails", []] },
                "$creatorMentorDetails",
                "$creatorUserDetails",
              ],
            },
            linkedCourse: { $first: "$linkedCourses.courseTitle" },
            linkedBadge: { $first: "$linkedCourses.badgeName" },
            usersMentions: {
              $concatArrays: ["$usersMentionsMember", "$usersMentionsMentor"],
            },
            liked: false,
            saved: false,
          },
        },
        {
          $project: {
            creatorUserDetails: 0,
            creatorMentorDetails: 0,
            linkedCourses: 0,
            usersMentionsMentor: 0,
            usersMentionsMember: 0,
          },
        },
      ]);
      return { result: true, data: samplePosts };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async deletePost({ postId, _id }) {
    try {
      const postData = await this.model.find({ _id: Types.ObjectId(postId) });

      if (isEmpty(postData)) throw "No post found to delete";
      if (postData[0].isDeleted === true) throw "post already deleted";
      if (String(postData[0].userId) !== _id)
        throw "Only the User created post can delete it";

      const data = await this.model.findOneAndUpdate(
        {
          _id: Types.ObjectId(postId),
          userId: Types.ObjectId(_id),
        },
        {
          $set: {
            isDeleted: true,
          },
        }
      );
      if (isEmpty(data)) throw "Error in deleting post";
      await User.updateMany({}, { $pull: { postSaved: postId } });
      await MentorUser.updateMany({}, { $pull: { postSaved: postId } });
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
  async editPost({ postId, _id, editData }) {
    try {
      const postData = await this.model.find({ _id: Types.ObjectId(postId) });

      if (isEmpty(postData)) throw "No post found to edit";
      if (postData[0].isDeleted === true) throw "deleted post cant be edited";
      if (String(postData[0].userId) !== _id)
        throw "Only the User created post can edit it";
      const data = await this.model.findOneAndUpdate(
        {
          _id: Types.ObjectId(postId),
          userId: Types.ObjectId(_id),
        },
        {
          $set: editData,
        },
        {
          new: true,
        }
      );
      if (isEmpty(data)) throw "Error in editing post";
      return { result: true, data: data };
    } catch (error) {
      return { result: false, data: error };
    }
  }
}

module.exports = new PostDetailService();
