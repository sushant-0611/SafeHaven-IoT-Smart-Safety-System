require("dotenv").config();

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  mongodbUri: process.env.MONGODB_URI,

  jwtSecret:
    process.env.JWT_SECRET || "change_this_safehaven_secret",

  clientUrl:
    process.env.CLIENT_URL || "http://localhost:5173",
};

if (!env.mongodbUri) {
  console.error("");
  console.error("====================================");
  console.error("      SAFEHAVEN ENV ERROR");
  console.error("====================================");
  console.error("MONGODB_URI is missing from .env");
  console.error("Expected file:");
  console.error("server/.env");
  console.error("====================================");
  console.error("");
}

module.exports = env;