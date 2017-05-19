let express = require("express");

let user = require("./user");
let models = require("../models"),
    User = models.User;
let utils = require("../utils");

let router = express.Router();

router.get("/manage", user.requireLogin, (req, res, next) => {
    res.locals.page.csrfToken = req.csrfToken();
    res.render("team/manage");
});

router.post("/update", (req, res, next) => {
    let usernames = req.body.usernames;
    let timezones = req.body.timezones;
    console.log(usernames, timezones);
    if (usernames.length !== timezones.length) {
        req.flash("danger", "Couldn't update team: mismatched usernames/timezones.");
        return res.redirect("/team/manage");
    }
    let team = utils.zip(usernames, timezones);
    team = team.filter(([a, b]) => a || b);
    team = team.map(([a, b]) => [a, (isNaN(parseInt(b))) ? null : parseInt(b)]);
    if (!team.find(([a, b]) => a.toLowerCase() == res.locals.user.usernameLower)) {
        req.flash("danger", "Couldn't update team: your team must include yourself.");
        return res.redirect("/team/manage");
    }
    console.log("TEAM", team);
    User.findOne({ _id: res.locals.user.id }).then((user) => {
        user.team = team.map(([a, b]) => ({ username: a, timezone: b }));
        return user.save();
    }).then((user) => {
        console.log(user);
        req.flash("success", "Team updated!");
        return res.redirect("/team/manage");
    });
});

module.exports = router;
