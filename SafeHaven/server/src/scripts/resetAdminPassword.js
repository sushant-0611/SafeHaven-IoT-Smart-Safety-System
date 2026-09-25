const bcrypt = require("bcryptjs");

const connectDatabase = require("../config/db");
const User = require("../models/User");

async function resetAdminPassword() {
  try {
    await connectDatabase();

    const email = "admin@safehaven.local";
    const newPassword = "SafeHaven@123";

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    user.passwordHash = passwordHash;
    user.status = "ACTIVE";
    user.role = "SUPER_ADMIN";

    await user.save();

    console.log("");
    console.log("====================================");
    console.log("   SAFEHAVEN ADMIN PASSWORD RESET");
    console.log("====================================");
    console.log("");
    console.log(`Email: ${email}`);
    console.log(`New password: ${newPassword}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log("");
    console.log("Password reset successfully.");
    console.log("");
    console.log("====================================");
  } catch (error) {
    console.error("");
    console.error("Password reset failed:");
    console.error(error.message);
    console.error("");
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

resetAdminPassword();