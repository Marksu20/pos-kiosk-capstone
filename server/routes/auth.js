const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { error } = require('console');

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
});
router.get('/staff-logout', (req, res) => {
  req.session.destroy(error => {
    if(error) {
      console.log(error);
      res.send('Error logging out');
    } else {
      res.redirect('/staff-login')
    }
  })
});

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

  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase();

  // Email validation 
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate fields and show errors
  if (!isValidEmail(normalizedEmail)) {
    return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'Invalid email format!' });
  }
  if (!companyName) {
    return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'Company Name is required!' });
  }
  if (password !== confirmPassword) {
    return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'Passwords do not match!' });
  }
  if (password.length < 4) {
    return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'Password must be at least 4 characters long!' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ emailAddress: normalizedEmail });
    if (existingUser) {
      return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'User already exists!' });
    }

    // Hash the password and create a new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      companyName,
      emailAddress: normalizedEmail,
      password: hashedPassword,
      role: 'admin'
    });

    await newUser.save();
    return res.render('index', { success_msg: 'Registered Successfully! You can Sign In now' });
  } catch (error) {
    // Handle duplicate key error or other errors
    if (error.code === 11000) {
      return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'Email already registered. Please use a different email.' });
    }
    return res.render('signup', { companyName, email: normalizedEmail, error_msg: 'An error occurred during registration. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ emailAddress: email });

    if(!user) {
      return res.render('index', { email, password, error_msg: 'Invalid email or password' });
    };

    if (user.role === 'sub-admin' || user.role === 'staff'){
      return res.render('index', {
        email,
        password,
        error_msg: 'You are not authorized to access this portal',
      });
    };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('index', { 
        email, 
        password, 
        error_msg: 'Invalid email or password' });
    };

    // Use req.login to ensure the user is stored in session
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/pos'); // Redirect after success
    });
  } catch (error) {
      console.log("error",  error);
      return res.render('index', { 
        email, 
        password, 
        error_msg: 'An error occurred while logging in.' });
      };
});

router.post('/staff-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ 
      $or: [{ emailAddress: username }, { displayName: username }]
     });

    if(!user) {
      return res.render('staff-login', { 
        username, 
        password, 
        error_msg: 'Invalid email or password' });
    };

    if (user.role === 'admin'){
      return res.render('staff-login', {
        username,
        password,
        error_msg: 'You are not authorized to access this portal',
      });
    };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('staff-login', { 
        username, 
        password, 
        error_msg: 'Invalid email or password' });
    };

     // Use req.login to ensure the user is stored in session
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/pos'); // Redirect after success
    });
  } catch (error) {
    console.log("error during staff login: ",  error);
    return res.render('staff-login', { 
      username,
      password,
      error_msg: 'An error occured while logging in' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ emailAddress: email });
    if (!user) {
        return res.render('index', {error_msg: 'User does not exists!' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();


    //https://kokapos.onrender.com
    // Send email with reset link
    const resetUrl = `http://localhost:5000/reset-password/${resetToken}`;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
      to: user.emailAddress,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset',
      text: `You are receiving this because you have requested the reset of your account's password. 
      Please click the following link to reset your password: ${resetUrl}`
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        return res.render('index', {error_msg: 'Error sending email.' });
      }
      return res.render('index', {success_msg: 'Email sent successfully, check your inbox.' });
    });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findOne({ 
      resetPasswordToken: token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    // check if user token valid or expired
    if (!user) {
      // return res.render('reset-password', {token, error_msg: 'Password reset token is invalid or has expired.' });
      return res.send('Password reset token is invalid or has expired.') 
    }

    // check if passwords match
    if (newPassword !== confirmPassword) {
      return res.render('reset-password', {token, error_msg: 'Passwords do not match!' });
    }

    // Password length validation 
    if (newPassword.length < 4) {
      return res.render('reset-password', {token, error_msg: 'Password must be at least 4 characters long!' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);  // generate salt
    const hashedPassword = await bcrypt.hash(newPassword, salt);  // hash the password

    // Set the new hashed password
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    return res.render('reset-password', {token, success_msg: 'Password successfully changed!'})
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).send('Server error');
  }
});

router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send('Password reset token is invalid or has expired.');
    }

    res.render('reset-password', { 
      token,
    }); // render a form to enter a new password
  } catch (error) {
    res.status(500).send('Server error');
  }
});

module.exports = router;