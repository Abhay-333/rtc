import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
{
    participants:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ]
},
{
    timestamps:true
});

let ConversationModel=mongoose.model("Conversation",ConversationSchema)

export default ConversationModel