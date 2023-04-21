const { Schema } = require("mongoose");

const CategorySchema = new Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
  },
  { timestamps: false }
);

const CommonSchema = {
  name: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  regType: {
    type: String,
    required: true,
    enum: ["phone", "google", "apple"],
  },
  socialRegId: {
    type: String,
  },
  phoneNumber: {
    type: String,
    unique: true,
    required: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },
  age: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    enum: ["member", "mentor"],
  },
  authToken: {
    type: String,
  },
  FCMToken: {
    type: String,
  },
  bio: {
    type: String,
  },
  wellnessGoal: {
    type: String,
  },
  wellnessCategories: {
    type: [CategorySchema],
  },
  profilePic: {
    type: String,
  },
  followers: {
    type: Number,
    default: 0,
  },
  following: {
    type: Number,
    default: 0,
  },
  badges: {
    type: Number,
    default: 0,
  },
  postSaved: {
    type: [String],
    default: [],
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
};

module.exports = CommonSchema;
