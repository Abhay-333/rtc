import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";

const protect = (req, res, next) => {
  try {
    let token;

    // 1. cookie token (for httpOnly auth)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. bearer token (for frontend header auth)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // no token found
    if (!token) {
      throw new ApiError(401, "Unauthorized user - No token provided");
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, email, etc }

    next();
  } catch (error) {
    next(new ApiError(401, "Unauthorized user - Invalid token"));
  }
};

export default protect;