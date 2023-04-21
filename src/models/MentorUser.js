const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const CommonSchema = require("./CommonUser");

class MentorUserSchema {
  initSchema() {
    const schema = new Schema(
      {
        ...CommonSchema,
        wellnessRole: {
          type: String,
          default: "",
        },
        tags: {
          type: [String],
        },
      },
      { timestamps: true }
    );

    schema.plugin(uniqueValidator);

    try {
      model("mentor", schema);
    } catch (e) {
      console.log("error in using users model", e);
    }
  }
  getInstance() {
    this.initSchema();
    return model("mentor");
  }
}

const MentorUser = new MentorUserSchema().getInstance();

module.exports = MentorUser;
