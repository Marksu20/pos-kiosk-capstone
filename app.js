require('dotenv').config();

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const connectDB = require('./server/config/db');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const socketIO = require('socket.io');
const flash = require('connect-flash');

const app = express();
const port = 5000 || process.env.PORT;

app.use(session({
  secret: 'keyboard dog',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  // cookie: { maxAge: new Date ( Date.now() + (3600000) )}
  // Date.now() - 30 * 24 * 60 * 1000
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static('public'));

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Database Connection
connectDB();

// templateting engine
app.use(expressLayouts);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');


// routes
app.use('/', require('./server/routes/auth'));
app.use('/', require('./server/routes/index'));
app.use('/', require('./server/routes/pos'));
app.use('/', require('./server/routes/admin'));
app.use('/', require('./server/routes/kiosk'));

// handle 404
app.get('*', function(req, res) {
  res.status(404).render('404');
})

app.listen(port, () => {
  console.log(`app running on http://localhost:${port}`);
});