import jwt from "jsonwebtoken";

export function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Sends the JWT as an httpOnly cookie (safer default) AND in the JSON body
// (convenient for mobile clients using Authorization: Bearer).
export function sendTokenResponse(user, statusCode, res) {
  const token = signToken(user._id);
  const days = Number(process.env.JWT_COOKIE_EXPIRES_DAYS) || 7;

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: days * 24 * 60 * 60 * 1000,
  });

  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  delete safeUser.resetPasswordToken;
  delete safeUser.resetPasswordExpire;

  res.status(statusCode).json({ success: true, token, user: safeUser });
}
