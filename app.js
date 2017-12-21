/**
 * 
 *  This is an Express Web Chat that uses modern web development technologies and follows the REST pattern
 * 
 *  @author: Francisco Garcia
 *  @version: 1.2
 * 
 */
 
// ==========================================================
// Require Packages
// ==========================================================
var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var expressSession = require("express-session");
var passport = require("passport");
var localStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var socket = require("socket.io");
var flash = require("connect-flash");

// ==========================================================
// Additional Variables
// ==========================================================
var socketConnections = [];
var usersConnected = [];

// ==========================================================
// Require Models
// ==========================================================
var User = require("./models/user.js");
var Message = require("./models/message.js");

// ==========================================================
// Set up Mongoose (Database)
// ==========================================================
//Set url for database connection
var url = process.env.DATABASEURL || "mongodb://localhost/web-chat";

//Connect to database
mongoose.connect(url, { useMongoClient: true });

// ==========================================================
// Grant access to Stylesheets & Scripts in public directory
// ==========================================================
//Allows application to use Stylesheets and Scripts
app.use(express.static(__dirname + "/public"));

// ==========================================================
// Set up body-parser
// ==========================================================
//Tell "express" to use "body-parser" (allows program to obtain data from a form, this is needed anytime program is using a form and posting data to a request)
//NOTE: "body-parser" extracts the entire body portion of an incoming request stream and exposes it on req.body.
app.use(bodyParser.urlencoded({extended: true}));

// ==========================================================
// Set up connect-flash
// ==========================================================
//Tell "express" to use "connect-flash"
app.use(flash());

// ==========================================================
// Set Up express-session
// ==========================================================
//Tell "express" to use "express-session"
app.use(expressSession({
	//secret is used to encode and decode the sessions
    secret: "This string encodes and decodes the sessions",
    resave: false,
    saveUninitialized: false
}));

// ==========================================================
// Set Up Passport
// ==========================================================
//Tell "express" to use "passport" (Basically set up passport)
//Need this two lines anytime "passport" is used
app.use(passport.initialize());
app.use(passport.session());

//Tell "passport" to use "passport-local" (Basically set up passport-local)
//User.authenticate() comes from the user.js file, but authenticate() comes from "passport-local-mongoose"
passport.use(new localStrategy(User.authenticate()));

//Line is responsible for encoding the data of the session
passport.serializeUser(User.serializeUser());
//Line is responsible for unencoding the data of the session
passport.deserializeUser(User.deserializeUser());
//NOTE: Both (the functions inside the brackets) serializeUser() and deserializeUser() come from passport-local-mongoose

// ==========================================================
// Pass content to every ejs file
// ==========================================================
app.use(passLoggedInUser);
app.use(passFlashMessage);

// ==========================================================
// ROUTES
// ==========================================================
//ROOT ROUTE - Renders the home page
app.get("/", function(req, res){
    res.render("home.ejs");
});

//INDEX ROUTE - Renders the chat
//Note: isLoggedIn middleware checks that a user is logged in
app.get("/chat", isLoggedIn, function(req, res){
    res.render("chat.ejs");
});

// ==========================================================
// AUTHENTICATION ROUTES
// ==========================================================
//SIGN UP ROUTES
//INDEX ROUTE - Show the Sign Up Form
app.get("/register", function(req, res){
    res.render("register.ejs"); 
 });

//CREATE ROUTE - Sign Up Functionality (Register user to application)
app.post("/register", function(req, res){

	//Note: password is not included in the newUser object, because it is a bad idea to save the actual password in the data base
	//Therefore the password is passed as the second parameter in the User.register function, then User.register will make a hash (with salt) that will be save in the data base instead  
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            //Second parameter is the Flash message
            return res.render("register.ejs", {"error": err.message});
        }
        //Login the user (with a passport "local" strategy) and run the passport.serializeUser method
        passport.authenticate("local")(req, res, function(){
           res.redirect("/chat");
        });
    });
});

//LOGIN ROUTES
//INDEX ROUTE - Show the Login Form
app.get("/login", function(req, res){
    res.render("login.ejs"); 
 });

//CREATE ROUTE - Login Functionality
//The second parameter is the passport.authenticate method functioning as Middleware, therefore there is no need for a callback function
app.post("/login", 
    passport.authenticate("local", {
        successRedirect: "/chat", 
        failureRedirect: "/login", 
        failureFlash: 'Invalid username and password combination'
    }) 
);

//LOGOUT ROUTE
//INDEX ROUTE - Logout Functionality
app.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged out");
    res.redirect("/");
});

// ==========================================================
// MIDDLEWARE
// ==========================================================
//Function passLoggedInUser() sends the loggedInUser (with both username and its unique id) object to every ejs file
function passLoggedInUser(req, res, next){
    //Whatever is put in res.locals, is available in all the routes
    res.locals.loggedInUser = req.user;
    //Move on to next Middleware
    next();
}
//Function passFlashMessage() sends the Flash message object to every ejs file
function passFlashMessage(req, res, next){
    res.locals.error = req.flash("error"); 
    res.locals.success = req.flash("success"); 
    next();
}

//Function isLoggedIn() checks if user is logged in or logged out of application
function isLoggedIn(req, res, next){
    //if the user is logged in
    if(req.isAuthenticated()){
         //Move on to next Middleware (in this case: function(req, res))
        return next();
    }
    //else, redirect user to login page
    else{
        req.flash("error", "Please login first");
        res.redirect("/login");
    }    
}

// ==========================================================
// START SERVER
// ==========================================================
//Set port of application
var port = process.env.PORT || 8080;
var ip = process.env.IP;

//Start Server
var server = app.listen(port, ip, function(){
   console.log("Listening on port " + port); 
});

// ==========================================================
// SOCKET.IO Content
// ==========================================================
//Set up socket.io to work with the established server
var io = socket(server);

//Listen for a connection on the GET /chat route
io.on("connection", function(socket){

    //Save the logged in user in a variable
    var loggedInUser = socket.handshake.query.data;

    console.log("Made socket connection... Socket ID:", socket.id);

    //Push this instance of a connection in the socketConnections array
    socketConnections.push(socket);
    
    //Push the logged in user in the usersConnected array
    usersConnected.push(loggedInUser);

    //Tell the front end to update the Online Users column
    io.sockets.emit("updateOnlineUsers", usersConnected);

    //Emit Chat and store on Database
    socket.on('chat', function(data){

        //If user inputs the clear command, erase that users chat log
        if(data.includes("/clear")){	
            socket.emit('clear');
         }
        //Else, emit chat message to all sockets
        else{
            //Timestamp for message
            var timeStamp = (new Date()).toLocaleTimeString();

            //Generate the message
            var chatMessage = timeStamp + " " + loggedInUser + ": " + data;

            // //For Version 2 

            // //Create a Message object that will be save in the database
            // var aChatMessage = new Message({
            //     message: chatMessage
            // });

            // //Save Message object to database
            // aChatMessage.save(function(err, msg){
            //     if(err){
            //         console.log(err);
            //     }
            //     else{
            //         console.log("Saved a message to database:")
            //         console.log(msg);
            //     }
            // });

            //Emit to Front End
            io.emit('chat', {msg:chatMessage, user:loggedInUser});
        }
        
    });

    //Update online users when user/socket disconnects(or logouts)
    socket.on("disconnect", function(data){

        //Remove disconnected user from the usersConnected array
        usersConnected.splice(usersConnected.indexOf(loggedInUser), 1);
            
        //Tell the front end to update the Online Users column
        io.sockets.emit("updateOnlineUsers", usersConnected);

        console.log("Removed socket connection... Socket ID:", socket.id);

        //Remove disconnected socket from the socketConnectionsarray
		socketConnections.splice(socketConnections.indexOf(socket), 1);	
	});

});