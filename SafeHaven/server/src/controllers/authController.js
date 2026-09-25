const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const env = require("../config/env");

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: "7d",
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie("safehaven_token", token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const {
      name,
      email,
      mobile,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const userCount = await User.countDocuments();

    const role =
      userCount === 0
        ? "SUPER_ADMIN"
        : "VIEWER";

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      mobile: mobile
        ? String(mobile).trim()
        : null,
      passwordHash,
      role,
      status: "ACTIVE",
    });

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(
      "Register error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "User account is not active",
      });
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();

    await user.save();

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  res.clearCookie("safehaven_token", {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production"
      ? "none"
      : "lax",
  });

  return res.json({
    success: true,
    message: "Logout successful",
  });
}

// GET /api/auth/me
async function getCurrentUser(req, res) {
  return res.json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      mobile: req.user.mobile,
      role: req.user.role,
      status: req.user.status,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
};