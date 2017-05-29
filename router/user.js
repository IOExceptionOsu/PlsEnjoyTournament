let express = require("express");
let form = require("express-form"), field = form.field;
let osu = require("osu")(process.env.OSU_APIKEY);

let models = require("../models"),
    Token = models.Token,
    User = models.User;
let utils = require("../utils");

// middleware for requiring login
let requireLogin = (req, res, next) => {
    if (!res.locals.user.isAuthenticated) {
        req.flash("danger", "You must be logged in to see this page.");
        return res.redirect("/user/login");
    }
    next();
};

let router = express.Router();

router.get("/login", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    res.locals.page.csrfToken = req.csrfToken();
    res.render("user/login");
});

router.post("/login", form(
    field("identifier").trim().required(),
    field("password").required()
), (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    if (!req.form.isValid) {
        req.flash("danger", req.form.errors.join(" "));
        return res.redirect("/user/login");
    }
    var _user;
    User.find().byIdentifier(req.form.identifier).exec().then((user) => {
        if (!user) {
            req.flash("danger", "Check that your username/email and password are correct.");
            return Promise.reject(res.redirect("/user/login"));
        }
        if (!user.emailVerified) {
            req.flash("danger", "Your account hasn't been activated yet. Check your email for an activation link!");
            return Promise.reject(res.redirect("/user/login"));
        }
        _user = user;
        return user.checkPassword(req.form.password);
    }).then((success) => {
        if (!success) {
            req.flash("danger", "Check that your username/email and password are correct.");
            return Promise.reject(res.redirect("/user/login"));
        }
        let token = new Token({
            type: "login",
            uid: _user._id.toString(),
            sid: utils.randomString(32),
            userAgent: req.details.userAgent,
            userIP: req.details.userIP
        });
        return token.save();
    }).then((token) => {
        req.session.uid = _user._id.toString();
        req.session.sid = token.sid;
        req.flash("success", "Successfully logged in!");
        return res.redirect("/");
    });
});

router.get("/logout", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // disable token
        Token.findOne({
            type: "login",
            uid: req.session.uid,
            sid: req.session.sid,
            expired: false
        }).then((token) => {
            if (token) {
                token.expired = true;
                return token.save();
            }
        }).then(() => {
            // delete the session
            delete req.session.uid;
            delete req.session.sid;
            if (req.session.destroy)
                req.session.destroy();
            return res.redirect("/");
        });
    } else {
        return res.redirect("/");
    }
});

router.get("/settings", requireLogin, (req, res, next) => {
    res.locals.page.csrfToken = req.csrfToken();
    res.render("user/settings");
});

router.get("/register", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    res.locals.page.csrfToken = req.csrfToken();
    res.locals.page.registrationOpen = parseInt(process.env.REGISTRATION_OPEN) * 1000;
    res.render("user/register");
});

router.post("/register", form(
    field("email").trim().required().isEmail(),
    field("username").trim().required(),
    field("password").required()
), (req, res, next) => {
    var hpwd;
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    if (!req.form.isValid) {
        req.flash("danger", req.form.errors.join(" "));
        return res.redirect("/user/register");
    }
    // hash the password
    User.find().byEmail(req.form.email).exec().then((user) => {
        if (user) {
            req.flash("danger", "This email has already been registered.");
            return Promise.reject(res.redirect("/user/register"));
        }
        return User.find().byUsername(req.form.username).exec();
    }).then((user) => {
        if (user) {
            req.flash("danger", "This username has already been registered.");
            return Promise.reject(res.redirect("/user/register"));
        }
        return utils.hashPassword(req.form.password);
    }).then((hashedPassword) => {
        hpwd = hashedPassword;
        return osu.get_user({ u: req.form.username.toLowerCase(), type: "string" });
    }).then((users) => {
        let oid = -1;
        if (users && users.length) {
            oid = parseInt(users[0].user_id);
        }
        // create a new user object
        let user = new User({
            email: req.form.email.toLowerCase(),
            username: req.form.username,
            usernameLower: req.form.username.toLowerCase(),
            password: hpwd,
            emailCode: utils.randomString(32),
            osuid: oid,
            team: [{ username: req.form.username, timezone: 0 }],
            teamname: "Team " + req.form.username,
            checklist: [{ good: false, message: "Please fill out your information below." }]
        });
        return user.save();
    }).then((user) => {
        let email = utils.activationEmail(`${req.protocol}://${req.headers.host}/user/verify/email/${user.emailCode}`);
        return utils.sendEmail(req.form.email, email.subject, email.body);
    }).then((result) => {
        req.flash("success", "Thanks for registering! Check your email for the activation link.");
        res.redirect("/user/login");
        next();
    });
});

router.get("/verify/email/:code", (req, res, next) => {
    let code = req.params.code;
    if (!code) {
        req.flash("danger", "Code not found.");
        return res.redirect("/");
    }
    User.findOne({ emailCode: code }).then((user) => {
        if (!user) {
            req.flash("danger", "Code not found.");
            return Promise.reject(res.redirect("/"));
        }
        if (user.emailVerified) {
            req.flash("danger", "Email already verified.");
            return Promise.reject(res.redirect("/"));
        }
        user.emailVerified = true;
        return user.save();
    }, () => {
        req.flash("danger", "Code not found.");
        return Promise.reject(res.redirect("/"));
    }).then((user) => {
        req.flash("success", "Thanks for verifying your email! You can log in now.");
        return res.redirect("/user/login");
    });
});

router.get("/verify/osu/:code", (req, res, next) => {
    let code = req.params.code;
    if (!code) {
        req.flash("danger", "Code not found.");
        return res.redirect("/");
    }
    User.findOne({ osuCode: code }).then((user) => {
        if (!user) {
            req.flash("danger", "Code not found.");
            return Promise.reject(res.redirect("/"));
        }
        if (user.osuVerified) {
            req.flash("danger", "osu! account already verified.");
            return Promise.reject(res.redirect("/"));
        }
        user.osuVerified = true;
        return user.save();
    }, () => {
        req.flash("danger", "Code not found.");
        return Promise.reject(res.redirect("/"));
    }).then((user) => {
        req.flash("success", "Thanks for verifying your osu! account!");
        return res.redirect("/user/settings");
    });
});

router.get("/verify/osu", requireLogin, (req, res, next) => {
    if (!(process.env.OSU_IRCHOST && process.env.OSU_USERNAME && process.env.OSU_IRCKEY)) {
        console.log(process.env);
        req.flash("danger", "osu! verification hasn't been set up properly. Please contact an admin.");
        return res.redirect("/user/settings");
    }
    let user = res.locals.user;
    let token = utils.randomString(32);
    res.locals.user.osuCode = token;
    res.locals.user.osuVerified = false;
    res.locals.user.save().then(() => {
        let link = `${req.protocol}://${req.headers.host}/user/verify/osu/${user.osuCode}`;
        return utils.sendInGameMessage(user.username, `Click [${link} this link] to verify your pls enjoy tournament account.`);
    }).then(() => {
        req.flash("info", `Verification link has been sent. Check your messages (from ${process.env.OSU_USERNAME})!`);
        return res.redirect("/user/settings");
    });
});

module.exports = router;
module.exports.requireLogin = requireLogin;