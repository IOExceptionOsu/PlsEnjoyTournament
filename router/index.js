let express = require("express");

let team = require("./team");
let user = require("./user");

// use router instead of passing app object around
let router = express.Router();

// include other routers
router.use("/team", team);
router.use("/user", user);

router.get("/", (req, res, next) => {
    res.render("pages/index");
});

router.get("/timezone", (req, res, next) => {
    res.render("pages/timezone");
});

module.exports = router;
