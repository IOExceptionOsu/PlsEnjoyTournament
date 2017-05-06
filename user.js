let isAuthenticated = (req) => {
    return new Promise((resolve, reject) => {
        if (!(req.signedCookies && req.signedCookies.sid && req.signedCookies.email)) {
            // cookies are missing, reject request
            return reject("It doesn't look like you've logged in before.");
        }
    });
};

module.exports.isAuthenticated = isAuthenticated;
