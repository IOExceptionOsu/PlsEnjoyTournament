let express = require("express");

let user = require("./user");

let router = express.Router();

router.get("/manage", user.requireLogin, (req, res, next) => {
    res.locals.page.csrfToken = req.csrfToken();
    res.render("team/manage");
});

module.exports = router;
