let express = require("express");

let user = require("./user");

// use router instead of passing app object around
let router = express.Router();

// include other routers
router.use("/user", user);

router.get("/", (req, res, next) => {
    res.render("pages/index");
});

module.exports = router;
