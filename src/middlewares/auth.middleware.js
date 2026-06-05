import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';

// auth middleware to verify the token and save the user in requested body
const protect = (req, res, next) => {

    const token = req.cookies.token;
    // Check the toke is present or not 
    if(!token){
        throw new ApiError(401,"Unauthorized user")
    }
  
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user; // { id: "user_id", email: "user_email" }


    next();
}

export default protect