const { Types } = require("mongoose");
const { FollowersListSchema } = require("../models/index.models");
const { getSampleMentorsList } = require("../services/MentorUserService");

class CommonController {
  getSampleMentorsListController = async (req, size) => {
    try {
      let { alreadyFetchedMentorsId = [], _id } = req.body;
      alreadyFetchedMentorsId = alreadyFetchedMentorsId.map((item) =>
        Types.ObjectId(item)
      );
      let mentorList = await FollowersListSchema.find(
        {
          followerId: _id,
          influencerRole: "mentor",
          currentFollowStatus: true,
        },
        "influencerId -_id"
      );
      mentorList = mentorList.map((item) => item.influencerId);
      return await getSampleMentorsList({
        mentorList,
        alreadyFetchedMentorsId,
        size,
      });
    } catch (error) {
      return { result: false, data: error };
    }
  };
}

module.exports = new CommonController();
