const { Schema } = require("mongoose");
const { Types } = Schema;

const CourseBadgeSchema = new Schema({
  badgeName: {
    type: String,
    required: true,
  },
  badgeDescription: {
    type: String,
    required: true,
  },
  badgeTriggerId: {
    type: Types.ObjectId,
    required: true,
  },
  badgeCreatorId: {
    type: Types.ObjectId,
    required: true,
  },
  badgeCourseId: {
    type: Types.ObjectId,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
  updatedAt: {
    type: Date,
    default: new Date(),
  },
});

module.exports = CourseBadgeSchema;
