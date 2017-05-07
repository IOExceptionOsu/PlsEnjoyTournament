let bcrypt = require("bcrypt");
let mongoose = require("mongoose");
let uuid = require("uuid");

let TokenSchema = new mongoose.Schema({
    "_id": { type: String, default: uuid.v4 },
    "type": String,
    "uid": String,
    "sid": String,
    "created": { type: Date, default: Date.now },
    "expired": { type: Boolean, default: false },
    "userAgent": String,
    "userIP": String
});

module.exports.Token = mongoose.model("Token", TokenSchema);

let UserSchema = new mongoose.Schema({
    "_id": { type: String, default: uuid.v4 },
    "admin": { type: Boolean, default: false },
    "osuid": Number,
    "teamid": String,
    "username": String,
    "usernameLower": String,
    "email": String,
    "password": String,
    "registered": { type: Date, default: Date.now },
    "emailVerified": { type: Boolean, default: false },
    "emailCode": String,
    "osuVerified": { type: Boolean, default: false },
    "osuCode": String
});

UserSchema.query.byIdentifier = function (identifier) {
    return this.findOne({
        $or:
        [{ usernameLower: identifier.toLowerCase() }, { email: identifier.toLowerCase() }]
    });
};

UserSchema.query.byEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

UserSchema.query.byUsername = function (username) {
    return this.findOne({ usernameLower: username.toLowerCase() });
};

UserSchema.methods.checkPassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

module.exports.User = mongoose.model("User", UserSchema);