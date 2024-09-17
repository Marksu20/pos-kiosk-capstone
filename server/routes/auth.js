const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User')
const bcrypt = require('bcryptjs')


passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
},

async function(accessToken, refreshToken, profile, done) {
  
  const newUser = {
    googleId: profile.id,
    emailAddress: profile.emails[0].value,
    displayName: profile.displayName,
    firstName: profile.name.givenName,
    lastName: profile.name.familyName,
    profileImage: profile.photos[0].value,
    companyName: null,
    adminPassword: null
  }

  try {
    let user = await User.findOne({ googleId: profile.id });
    if(user) {
      done(null, user);
    } else {
      user = await User.create(newUser);
      done(null, user);
    }
  } catch (error) {
    console.log(error);
  }
}
));

// google login route
router.get('/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'] }));

// retrieve use data
router.get('/google/callback', 
  passport.authenticate('google', {
    failureRedirect: '/signin-failure',
    successRedirect: '/pos'
  })
);

// route if something goes wrong
router.get('/signin-failure', (req, res) => {
  res.send('Something went wrong...')
});

// destroy session
router.get('/logout', (req, res) => {
  req.session.destroy(error => {
    if(error) {
      console.log(error);
      res.send('Error logging out');
    } else {
      res.redirect('/')
    }
  })
})

// presist user data after succesful authentication
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

// retrieve user data from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null)
  }
});

router.post('/signup', async (req, res) => {
  const { companyName, email, password, confirmPassword } = req.body;

  // Email validation function
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Check if email is valid
  if (!isValidEmail(email)) {
    return res.render('signup', { companyName, email, error_msg: 'Invalid email format' });
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.render('signup', { companyName, email, error_msg: 'Passwords do not match' });
  }

  // Password length validation (at least 8 characters)
  if (password.length < 4) {
    return res.render('signup', { companyName, email, error_msg: 'Password must be at least 4 characters long' });
  }

  const existingUser = await User.findOne({ emailAddress: email });
  if (existingUser) {
    return res.render('signup', { companyName, email, error_msg: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    companyName,
    emailAddress: email,
    password: hashedPassword
  });

  await newUser.save();
  return res.render('signup', {success_msg: 'Registered Successfully! click here to ' });
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ emailAddress: email });
  if(!user) {
    return res.render('index', { email, password, error_msg: 'Invalid email or password' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.render('index', { email, password, error_msg: 'Invalid email or password' });
  }

  // Use req.login to ensure the user is stored in session
  req.login(user, (err) => {
    if (err) {
      return next(err);
    }
    return res.redirect('/pos'); // Redirect after successful login
  });
  
})

module.exports = router;