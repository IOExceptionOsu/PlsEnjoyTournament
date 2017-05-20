/**
 * Pls Enjoy Tournament
 * by IOException
 * 
 * License: plz no copy
 */

Error.stackTraceLimit = Infinity;

let bodyParser = require("body-parser");
let cookieParser = require("cookie-parser");
let csurf = require("csurf");
let express = require("express");
let flash = require("express-flash");
let minify = require("express-minify");
let mongoose = require("mongoose");
let path = require("path");
let session = require("cookie-session");

let router = require("./router");
let user = require("./user");

let app = express();
// this should throw an error if DATABASE_URL isn't set
mongoose.Promise = Promise;
mongoose.connect(process.env.DATABASE_URL);

/*  configure views  */

// set default views folder
app.set("views", path.join(__dirname, "views"));
// use ejs rather than jade >_>
app.set("view engine", "ejs");

/*  install all middleware  */

// parse form input
app.use(bodyParser.urlencoded({ extended: true }));
// cookie read/write
app.use(cookieParser(process.env.COOKIE_SECRET));
// express session management
app.use(session({
    name: "plsenjoy.session",
    saveUninitialized: true,
    keys: [process.env.COOKIE_SECRET]
}));
// minify html pages
app.use(minify());
// csrf token
app.use(csurf({ cookie: true }));
// enable flash messages
app.use(flash());
// static folder
app.use("/static", express.static("static"));
// custom user auth middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    // assign local variables for rendering engine
    res.locals.page = {};
    res.locals.user = {};
    // for tracking the user
    req.details = {
        userAgent: req.headers["user-agent"],
        userIP: req.headers["x-forwarded-for"] || req.connection.remoteAddress
    };
    // check if user is authenticated
    user.isAuthenticated(req, res).then((user) => {
        // cool, user is logged in
        res.locals.user.id = user._id;
        res.locals.user.isAuthenticated = true;
        return user.team();
    }, (reason) => {
        // ignore reason for now lol
        res.locals.user.isAuthenticated = false;
        return user.team();
    }).then((team) => {
        res.locals.user.team = team;
        next();
    }, () => {
        next();
    });
});

// route the pages
app.use(router);

// error handler
app.use((err, req, res, next) => {
    if (err) {
        return res.send("There was an error: " + err);
    }
    return res.send("no error?");
});

let port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});