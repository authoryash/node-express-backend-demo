const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const CommonSchema = require("./CommonUser");

class UserSchema {
  initSchema() {
    const schema = new Schema(
      {
        ...CommonSchema,
        isRecommendationComplete: {
          type: Boolean,
          default: false,
        },
        enrolledCourses: {
          type: [String],
        },
        progressBar: {
          type: Number,
          default: 0,
        },
      },
      { timestamps: true }
    );

    schema.plugin(uniqueValidator);

    try {
      mongoose.model("user", schema);
    } catch (e) {
      console.log("error in using users model", e);
    }
  }

  getInstance() {
    this.initSchema();
    return mongoose.model("user");
  }
}

const User = new UserSchema().getInstance();

module.exports = { User };
