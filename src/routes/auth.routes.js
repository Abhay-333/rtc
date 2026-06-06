// This file defines the routes for user authentication-related API endpoints. It imports the Express router and the controller functions for user registration and login, and sets up POST routes for both operations.
import express from 'express'
import { loginController, registerController } from '../controllers/auth.controller.js'
import protect from '../middlewares/auth.middleware.js'
import { getMe } from '../controllers/auth.controller.js'
import { getUsers } from '../controllers/auth.controller.js'



// router setup for user authentication routes

let router =express.Router()
// POST API route for registering users
// URL: /register
// When a POST request comes to /register,
// registerController function will run

router.post('/register',registerController)

// POST API route for registering users
// URL: /register
// When a POST request comes to /register,
// registerController function will run

router.post('/login',loginController)

router.get('/me',protect,getMe)
// Get list of users (protected)
router.get('/users', protect, getUsers)


// Export confiured router so it can be used in other files
export default router