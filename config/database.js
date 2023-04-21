const mongoose = require("mongoose");
// const config = require( './config' ).getConfig();

// Mongo Connection Class
class Connection {
  constructor() {
    mongoose.Promise = global.Promise;
    mongoose.set("useNewUrlParser", true);
    mongoose.set("useFindAndModify", false);
    mongoose.set("useCreateIndex", true);
    mongoose.set("useUnifiedTopology", true);
    mongoose.set("debug", true);
    this.connect()
      .then(() => {
        console.log("✔ Database Connected");
      })
      .catch((err) => {
        console.error("✘ MONGODB ERROR: ", err.message);
      });
  }

  async connect() {
    mongoose.connect(process.env.MONGO_URL);
  }
}

module.exports = new Connection();
