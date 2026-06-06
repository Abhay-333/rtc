import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
{
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation",
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


let MessageModel=mongoose.model("Message",MessageSchema)

export default MessageModel