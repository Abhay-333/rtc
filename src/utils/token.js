import jwt from 'jsonwebtoken'  // Importing the jsonwebtoken library to generate and verify JWT tokens

// Function to generate a JWT token for a given user ID, using the secret key from environment variables and setting an expiration time of 1 hour
const tokenGenerate=(user)=>{
    return jwt.sign({id:user._id, email:user.email},process.env.JWT_SECRET,{
        expiresIn:"1h"
    })
}

export default tokenGenerate