import mongoose from "mongoose";

let connectDb=async()=>{
try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("mongodb connection successfull")
} catch (error) {
    console.log("Error in mongoDb connection")
}
}

export default connectDb