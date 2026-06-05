import mongoose from "mongoose";
import bcrypt from 'bcrypt'
const UserSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true
    },

    email:{
        type:String,
        required:true,
        unique:true
    },

    password:{
        type:String,
        required:true
    },

    avatar:{
        type:String,
        default:""
    },

    isOnline:{
        type:Boolean,
        default:false
    },

    lastSeen:{
        type:Date
    }
},
{
    timestamps:true
});



UserSchema.pre('save',async function(){
    if(!this.isModified('password')){
        return
    }
    this.password= await bcrypt.hash(this.password,10)
})

UserSchema.methods.ComparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

let UserModel=mongoose.model("User",UserSchema)
export default UserModel