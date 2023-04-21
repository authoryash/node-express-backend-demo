const autoBind = require("auto-bind");
const { Service } = require("../../system/services/Service");
const MentorUser = require("../models/MentorUser");

class MentorUserService extends Service {
  constructor(model) {
    super(model);
    this.model = model;
    autoBind(this);
  }

  async getSampleMentorsList({
    mentorList = [],
    alreadyFetchedMentorsId = [],
    size = 0,
  } = {}) {
    try {
      const sampleMentors = await this.model.aggregate([
        {
          $match: {
            ...((alreadyFetchedMentorsId.length || mentorList.length) && {
              _id: { $nin: [...alreadyFetchedMentorsId, ...mentorList] },
            }),
          },
        },
        { $sample: { size } },
        { $project: { name: 1, wellnessRole: 1, profilePic: 1, userName: 1 } },
      ]);
      return { result: true, data: sampleMentors };
    } catch (error) {
      return { result: false, data: error };
    }
  }
}

module.exports = new MentorUserService(MentorUser);
