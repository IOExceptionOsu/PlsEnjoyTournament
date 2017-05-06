let models = require("./models"),
    Token = models.Token,
    User = models.User;

let isAuthenticated = (req) => {
    console.log(req.session);
    return Token.findOne({
        type: "login",
        uid: req.session.uid,
        sid: req.session.sid,
        expired: false
    }).then((token) => {
        console.log("TOKEN", token);
        if (!token)
            return Promise.reject();
        return Promise.resolve(true);
    }, () => {
        return Promise.reject();
    });
};

module.exports.isAuthenticated = isAuthenticated;
