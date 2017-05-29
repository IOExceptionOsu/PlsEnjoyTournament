let express = require("express");
let form = require("express-form"), field = form.field;

let user = require("./user");
let models = require("../models"),
    OsuUser = models.OsuUser,
    User = models.User;
let utils = require("../utils");

let router = express.Router();

router.get("/all", (req, res, next) => {
    res.locals.teams = [];
    User.find().then((users) => {
        let teamPromises = [];
        users.forEach((user) => {
            let members = [];
            let memberPromises = [];
            user.team.forEach((member) => {
                let promise = OsuUser.findOne({ usernameLower: member.username.toLowerCase() }).then((ou) => {
                    if (!ou) {
                        ou = { rank: "None", id: -1 };
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
            teamPromises.push(Promise.all(memberPromises).then(() => {
                res.locals.teams.push({
                    approved: user.approved,
                    approvalDate: user.approvalDate,
                    captain: user.username,
                    lastUpdated: user.lastUpdated,
                    members: members,
                    teamname: user.teamname
                });
            }));
        });
        return Promise.all(teamPromises);
    }).then(() => {
        res.render("team/all");
    });
});

router.get("/manage", user.requireLogin, (req, res, next) => {
    res.locals.page.csrfToken = req.csrfToken();
    // res.locals.user.checkTeamEligibility().then((checklist) => {
    //     res.locals.user.registrationChecklist = checklist;
    //     res.locals.user.allGood = checklist.filter(x => !x.good).length == 0;
    res.render("team/manage");
});

router.post("/rename", user.requireLogin, form(field("teamname").trim().maxLength(24).required()), (req, res, next) => {
    if (!req.form.isValid) {
        req.flash("danger", "Couldn't update teamname: please enter a teamname.");
        return res.redirect("/team/manage");
    }
    let newTeamname = req.form.teamname;
    User.findOne({ _id: res.locals.user.id }).then((user) => {
        user.teamname = newTeamname;
        user.save().then(() => {
            req.flash("success", "Teamname updated!");
            return res.redirect("/team/manage");
        });
    });
    // res.send(res.locals.user.toString());
});

router.post("/update", user.requireLogin, (req, res, next) => {
    let usernames = req.body.usernames;
    let timezones = req.body.timezones;
    if (usernames.length !== timezones.length) {
        req.flash("danger", "Couldn't update team: mismatched usernames/timezones.");
        return res.redirect("/team/manage");
    }
    let team = utils.zip(usernames, timezones);
    team = team.filter(([a, b]) => a || b);
    team = team.map(([a, b]) => [a, (isNaN(parseInt(b))) ? null : b]);
    if (!team.find(([a, b]) => a.toLowerCase() == res.locals.user.usernameLower)) {
        req.flash("danger", "Couldn't update team: your team must include yourself.");
        return res.redirect("/team/manage");
    }
    let i = 0;
    let promises = [];
    for (let member of team) {
        // let ou = new OsuUser();
        // ou.username = member[0];
        // ou.usernameLower = member[0].toLowerCase();
        // promises.push(ou.fetch());
        promises.push(OsuUser.getInfo(member[0]));
    };
    let user;
    Promise.all(promises).then(() => {
        return User.findOne({ _id: res.locals.user.id })
    }).then((_user) => {
        user = _user;
        if (user === null) {
            return Promise.reject();
        }
        return user.checkTeamEligibility();
    }).then((checklist) => {
        user.checklist = checklist;
        user.allGood = checklist.filter(x => !x.good).length == 0;
        user.team = team.map(([a, b]) => ({ username: a, timezone: b }));
        user.lastUpdated = new Date();
        if (user.allGood) {
            user.approved = true;
            user.approvalDate = new Date();
        }
        return user.save();
    }).then((user) => {
        req.flash("success", "Team updated!");
        return res.redirect("/team/manage");
    });
});

module.exports = router;
