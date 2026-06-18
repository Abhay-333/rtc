import mongoose from "mongoose";

let connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("mongodb connection successfull");
  } catch (error) {
    console.log("Error in mongoDb connection",error); // if there is error in db connection then you can log the error here which can be helpful for debugging
  }
};

export default connectDb;
