var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

//Fix for "DeprecationWarning: Mongoose: mpromise" warnig from terminal
mongoose.Promise = global.Promise;

//Message Schema
var MessageSchema = new mongoose.Schema({
    message: { type : String, index: { unique: true }}
});

//Add methods from "passport-local-mongoose" to MessageSchema
MessageSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Message", MessageSchema);