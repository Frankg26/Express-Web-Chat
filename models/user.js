var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

//Fix for "DeprecationWarning: Mongoose: mpromise" warnig from terminal
mongoose.Promise = global.Promise;

//User Schema
var UserSchema = new mongoose.Schema({
    username: String,
    password: String
});

//Add methods from "passport-local-mongoose" to UserSchema
UserSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model("User", UserSchema);