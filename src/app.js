import dotenv from 'dotenv'
dotenv.config()
import express  from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRoutes from './routes/auth.routes.js'
import chatRoutes from './routes/chat.routes.js'

let app=express()

// CORS configuration for Socket.IO and API
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}))

app.use(express.json())
app.use(cookieParser())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/chat', chatRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: "Server is healthy" })
})

// Error handling middleware
app.use((err, req, res, next) => {
    let statusCode = err.statusCode || 500
    let message = err.message || "Internal server error"
    console.log("error", message)
    return res.status(statusCode).json({ message: message })
})

export default app
