import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
{
    groupName:{
        type:String,
        required:true
    },

    groupImage:{
        type:String,
        default:""
    },

    admin:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    members:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ]
},
{
    timestamps:true
});

let GroupModel=mongoose.model("Group",GroupSchema)

export default GroupModel