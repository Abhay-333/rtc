import dotenv from 'dotenv'
dotenv.config()
import express  from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
let app=express()
app.use(express.json())
app.use(cookieParser())
app.use('/api/auth',authRoutes)


app.use((err,req,res,next)=>{
    let statusCode=err.statusCode || 500
    let message=err.message || "Internal server error"
    console.log("error",message)
    return res.status(statusCode).json({message:message})
})
export default app
