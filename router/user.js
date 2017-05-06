let express = require("express");
let form = require("express-form"), field = form.field;

let models = require("../models"),
    Token = models.Token,
    User = models.User;
let utils = require("../utils");

let router = express.Router();

router.get("/verify/:code", (req, res, next) => {
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

router.get("/login", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    res.locals.page.csrfToken = req.csrfToken();
    res.render("pages/login");
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
            delete req.session.uid;
            delete req.session.sid;
            req.session.destroy();
            return res.redirect("/");
        });
    }
});

router.get("/register", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    res.locals.page.csrfToken = req.csrfToken();
    res.render("pages/register");
});

router.post("/register", form(
    field("email").trim().required().isEmail(),
    field("username").trim().required(),
    field("password").required()
), (req, res, next) => {
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
        // create a new user object
        let user = new User({
            email: req.form.email.toLowerCase(),
            username: req.form.username,
            usernameLower: req.form.username.toLowerCase(),
            password: hashedPassword,
            emailCode: utils.randomString(32)
        });
        return user.save();
    }).then((user) => {
        let email = utils.activationEmail(`${req.protocol}://${req.headers.host}/user/verify/${user.emailCode}`);
        return utils.sendEmail(req.form.email, email.subject, email.body);
    }).then((result) => {
        req.flash("success", "Thanks for registering! Check your email for the activation link.");
        res.redirect("/user/login");
        next();
    });
});

module.exports = router;
