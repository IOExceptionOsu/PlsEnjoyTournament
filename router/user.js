let express = require("express");
let form = require("express-form"), field = form.field;

let models = require("../models"),
    User = models.User;
let utils = require("../utils");

let router = express.Router();

router.get("/login", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        // user is already logged in
        return res.redirect("/");
    }
    res.locals.page.csrfToken = req.csrfToken();
    res.render("pages/login");
});

router.post("/login", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
        return res.redirect("/");
    }
    return res.redirect("/user/login");
});

router.get("/register", (req, res, next) => {
    if (res.locals.user.isAuthenticated) {
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
            console.log(user);
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
