import mongoose from "mongoose";

const GroupMessageSchema = new mongoose.Schema(
{
    groupId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Group",
        required:true
    },

    sender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    text:{
        type:String,
        required:true
    },

    readBy:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ]
    ,
    deliveredAt: {
        type: Date,
        default: null,
    }
    ,
    deleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    }
},
{
    timestamps:true
});

let GroupMessageModel=mongoose.model("GroupMessage",GroupMessageSchema)

export default GroupMessageModel