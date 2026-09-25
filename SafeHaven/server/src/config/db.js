const mongoose = require("mongoose");
const env = require("./env");

async function connectDatabase() {
  try {
    if (!env.mongodbUri) {
      throw new Error(
        "MONGODB_URI is missing. Please configure MONGODB_URI in server/.env"
      );
    }

    await mongoose.connect(env.mongodbUri);

    console.log("");
    console.log("====================================");
    console.log("       SAFEHAVEN DATABASE");
    console.log("====================================");
    console.log("MongoDB connected successfully");
    console.log(`Database: ${mongoose.connection.name}`);
    console.log("====================================");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("MongoDB connection failed:");
    console.error(error.message);
    console.error("");

    throw error;
  }
}

module.exports = connectDatabase;