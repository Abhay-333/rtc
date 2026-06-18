import UserModel from "../models/auth.model.js";

import ApiError from "../utils/apiError.js";
import tokenGenerate from "../utils/token.js";

export const registerService=async(data)=>{
  let { name, email, password } = data;
  // --Validation --
  // check if any field is empty
  if (!name || !email || !password)
    throw new ApiError(400, "All fields are required");
  // check if the length of name field is less than 3 characters
  if (name.length < 3)
    throw new ApiError(409, "Name should be atleast 3 characters long");
  // Check the format of email
  let emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }
  // Check if the length of password field is less than 6 characters
  if (password.length < 6)
    throw new ApiError(409, "Password should be atleast 6 characters long");
  // Check if user already exists with same email
  let isExisted = await UserModel.findOne({ email });

  // Throw error if email already registered
  if (isExisted) throw new ApiError(401, "Email already registered");
  // Create new user in database

  let newUser = await UserModel.create({
    name,
    email,
    password,
  });

  return {
    newUser
  }
}

export const loginService=async(data)=>{
        let {email,password}=data
      // Check if email or password is missing
    if(!email || !password){
        throw new ApiError(400,"All fields are required")
    }
    // Validate email format
    let emailRegex=/^\S+@\S+\.\S+$/;
    if(!emailRegex.test(email)){
        throw new ApiError(400,"Invalid email format")
    }
  
   // If a user with the same email already exists, throw an error
    let user=await UserModel.findOne({email})
   // If user does not exist
    if(!user) {
        throw new ApiError(404,"User not found")
    }

    // Compare entered password with hashed password

    let comparePass=await user.ComparePassword(password)
    // If password does not match
    if(!comparePass) {
      throw new ApiError(401,"Invalid Credentials")
    }
  // Return the user for use in the login service.
  return {
    user
  }
}