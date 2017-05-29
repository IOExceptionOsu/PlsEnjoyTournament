let bcrypt = require("bcrypt");
let mongoose = require("mongoose");
let osu = require("osu")(process.env.OSU_APIKEY);
let uuid = require("uuid");

let TokenSchema = new mongoose.Schema({
    "_id": { type: String, default: uuid.v4, unique: true },
    "type": String,
    "uid": String,
    "sid": String,
    "created": { type: Date, default: Date.now },
    "expired": { type: Boolean, default: false },
    "userAgent": String,
    "userIP": String
});

module.exports.Token = mongoose.model("Token", TokenSchema);

let TeamSchema = new mongoose.Schema({
    "_id": { type: String, default: uuid.v4 },
});

TeamSchema.methods.members = function () {
    return module.exports.User.find({ teamid: this._id.toString() });
};

module.exports.Team = mongoose.model("Team", TeamSchema);

let OsuUserSchema = new mongoose.Schema({
    "id": Number,
    "username": String,
    "usernameLower": String,
    "rank": Number,
    "pp": Number,
    "lastUpdated": Date
});

OsuUserSchema.statics.getInfo = function (username) {
    // if (this.lastUpdated && this.lastUpdated.getTime() + 28800000 < Date.now()) {
    //     return new Promise((resolve, reject) => { resolve(); });
    // }
    return module.exports.OsuUser.findOne({ usernameLower: username.toLowerCase() }).then((user) => {
        if (user !== null && user.lastUpdated && user.lastUpdated.getTime() + 28800000 > Date.now()) {
            return Promise.resolve(user);
        } else {
            let ou = new module.exports.OsuUser();
            ou.username = username;
            ou.usernameLower = username.toLowerCase();
            return ou.fetch();
        }
    });
};

OsuUserSchema.methods.fetch = function () {
    return osu.get_user({ u: this.usernameLower, type: "string" }).then((userInfo) => {
        if (!(userInfo && userInfo.length)) {
            this.id = -1;
            return this.save();
        }
        userInfo = userInfo[0];
        this.id = parseInt(userInfo.user_id);
        this.lastUpdated = new Date();
        this.pp = parseFloat(userInfo.pp_raw);
        this.rank = parseInt(userInfo.pp_rank);
        return this.save();
    });
};

module.exports.OsuUser = mongoose.model("OsuUser", OsuUserSchema);

let UserSchema = new mongoose.Schema({
    "_id": { type: String, default: uuid.v4, unique: true },
    "approved": { type: Boolean, default: false },
    "admin": { type: Boolean, default: false },
    "osuid": Number,
    "teamid": String,
    "username": String,
    "usernameLower": { type: String, unique: true },
    "email": String,
    "password": String,
    "checklist": [],
    "allGood": Boolean,
    "team": [],
    "teamname": String,
    "lastUpdated": Date,
    "approvalDate": Date,
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

UserSchema.methods.checkTeamEligibility = function () {
    let checklist = [];
    let done = () => {
        return Promise.resolve(checklist);
    };
    let members = [];
    return new Promise((resolve, reject) => {
        if (this.team.length == 3 || this.team.length == 4) {
            checklist.push({ good: true, message: "Your team has enough members to be eligible!" });
            resolve();
        } else {
            checklist.push({ good: false, message: "You still need " + (3 - this.team.length) + " more member(s)." });
            reject();
        }
    }).catch(done).then(() => {
        let members = [];
        let memberPromises = [];
        this.team.forEach((member) => {
            let promise = module.exports.OsuUser.findOne({ usernameLower: member.username.toLowerCase() }).then((ou) => {
                if (!ou) {
                    ou = { rank: undefined, id: -1 };
                }
                members.push({
                    username: member.username,
                    rank: ou.rank,
                    id: ou.id
                });
                return Promise.resolve();
            });
            memberPromises.push(promise);
        });
        return Promise.all(memberPromises).then(() => {
            return Promise.resolve(members);
        });
    }).catch(done).then((members) => {
        let badMembers = [];
        for (let member of members) {
            if (!member.id || member.id < 0) {
                badMembers.push(member.username);
            }
        }
        if (badMembers.length > 0) {
            checklist.push({ good: false, message: "Failed to fetch data for following players: " + badMembers.map(x => "<b>" + x + "</b>").join(", ") });
            return Promise.reject();
        }
        let ineligibleMembers = [];
        for (let member of members) {
            if (!member.rank || !(member.rank >= 1000 && member.rank <= 20000)) {
                ineligibleMembers.push(member.username);
            }
        }
        if (ineligibleMembers.length > 0) {
            checklist.push({ good: false, message: "The following players fall outside the rank range: " + ineligibleMembers.map(x => "<b>" + x + "</b>").join(", ") });
            return Promise.reject();
        }
        checklist.push({ good: true, message: "All of your team's members are accounted for and eligible!" });
        return Promise.resolve();
    }).catch(done).then(() => {
        let missingTimezone = [];
        for (let member of this.team) {
            try {
                if (member.timezone === null || member.timezone === "") throw new Error();
                let t = parseInt(member.timezone);
                if (Math.abs(t) > 24) throw new Error();
            } catch (e) {
                missingTimezone.push(member.username);
            }
        }
        if (missingTimezone.length > 0) {
            checklist.push({ good: false, message: "The following players don't have timezones: " + missingTimezone.map(x => "<b>" + x + "</b>").join(", ") });
            return Promise.reject();
        }
        checklist.push({ good: true, message: "All of your members have timezones!" });
    }).catch(done).then(done);
};

module.exports.User = mongoose.model("User", UserSchema);