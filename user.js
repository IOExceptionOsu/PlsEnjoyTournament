let models = require("./models"),
    Token = models.Token,
    User = models.User;

let isAuthenticated = (req, res) => {
    // check if existing token is valid
    return Token.findOne({
        type: "login",
        uid: req.session.uid,
        sid: req.session.sid,
        expired: false
    }).then((token) => {
        if (!token)
            return Promise.reject();
        // get user information with this token
        return User.findOne({ _id: token.uid });
    }, () => {
        return Promise.reject();
    }).then((user) => {
        // set user information
        if (!user)
            return Promise.reject();
        res.locals.user = user;
        return User.team();
    }, () => {
        return Promise.reject();
    }).then((team) => {
        // set team information
        res.locals.user.team = team;
        return Promise.resolve(true);
    }, () => {
        res.locals.user.team = null;
        return Promise.resolve(true);
    });
};

module.exports.isAuthenticated = isAuthenticated;
