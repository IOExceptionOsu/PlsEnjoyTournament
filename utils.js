let bcrypt = require("bcrypt");
let gmailSend = require("gmail-send");

let activationEmail = (link) => {
    return {
        subject: "Welcome to Pls Enjoy Tournament!",
        body: "Welcome. Here is the link: " + link + "."
    }
};

module.exports.activationEmail = activationEmail;

let randomString = (length) => {
    var length = length || 25;
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var randString = "";
    for (var i = 0; i < length; i++) {
        var R = Math.floor(Math.random() * chars.length);
        randString += chars.substring(R, R + 1);
    }
    return randString;
};

module.exports.randomString = randomString;

let hashPassword = (password) => {
    return bcrypt.hash(password, 10);
};

module.exports.hashPassword = hashPassword;

let sendEmail = (recipient, subject, body) => {
    let message = gmailSend({
        user: process.env.GMAIL_USERNAME,
        pass: process.env.GMAIL_PASSWORD,
        to: recipient,
        subject: subject,
        html: body
    });
    return new Promise((resolve, reject) => {
        message({}, (err, res) => {
            if (err) reject(err);
            resolve(res);
        });
    });
};

module.exports.sendEmail = sendEmail;