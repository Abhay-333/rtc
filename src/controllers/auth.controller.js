
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import tokenGenerate from "../utils/token.js";
import comparePassword from '../models/auth.model.js'
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
  // Send success response
  return res
    .status(201)
    .json(new ApiResponse("User registered successfully", newUser));
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
    let token=await tokenGenerate(user)
     res.cookie("token", token, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000,
  });
    // Success Response
    return res.status(200).json({
      message:"User logged in successfully",
      user
    })
    

})


export const getMe=asyncHandler(async(req,res)=>{
    res.status(200).json({
         success: true,
    user: req.user,
    })
})