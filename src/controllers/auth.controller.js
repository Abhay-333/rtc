
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import tokenGenerate from "../utils/token.js";
import UserModel from '../models/auth.model.js'
import { loginService, registerService } from "../services/auth.service.js";
/**
 * @route POST /api/auth/register
 * @description Create a new user and register in database
 * @access Public
 */
export const registerController = asyncHandler(async (req, res) => {
  // Extract newUser from register service
let {newUser}=await registerService(req.body)
  //   // Generate authentication token
  let token = await tokenGenerate(newUser);
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000,
  });
  // Send success response including token so frontend can use it
  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    user: newUser,
  });
});
/**
 * @route POST /api/auth/login
 * @description user will login by providing credentials
 * @access Public
 */
export const loginController=asyncHandler(async(req,res)=>{
// Extract email and password from request body

let {user}=await loginService(req.body)
// generate the token
    let token = await tokenGenerate(user);
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    });
    // Success Response including token
    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      token,
      user,
    });
    

})


export const getMe=asyncHandler(async(req,res)=>{
    res.status(200).json({
         success: true,
    user: req.user,
    })
})

// Get users list (protected)
export const getUsers = asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  // basic search by name or email
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }
    : {};

  const users = await UserModel.find(filter).select('name email avatar isOnline lastSeen');
  return res.status(200).json({ success: true, data: users });
});