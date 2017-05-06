/**
 * Pls Enjoy Tournament
 * by IOException
 * 
 * License: plz no copy
 */

let bodyParser = require("body-parser");
let cookieParser = require("cookie-parser");
let csurf = require("csurf");
let express = require("express");
let flash = require("express-flash");
let minify = require("express-minify");
let mongoose = require("mongoose");
let path = require("path");
let session = require("express-session");

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
    resave: false,
    saveUninitialized: true,
    secret: process.env.COOKIE_SECRET,
    cookie: { /*secure: true*/ }
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
    // assign local variables for rendering engine
    res.locals.page = {};
    res.locals.user = {};
    // check if user is authenticated
    user.isAuthenticated(req).then(() => {
        // cool, user is logged in
        res.locals.user.isAuthenticated = false;
        next();
    }, (reason) => {
        // ignore reason for now lol
        res.locals.user.isAuthenticated = false;
        next();
    });
});

// route the pages
app.use(router);

let port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});