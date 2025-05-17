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

  const normalizedEmail = email.toLowerCase();

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(companyName)) {
    return res.render('signup', {
      companyName,
      email: normalizedEmail,
      error_msg: 'Company Name must only contain letters, numbers, and spaces!'
    });
  }

  if (companyName.length > 20) {
    return res.render('signup', {
      companyName,
      email: normalizedEmail,
      error_msg: 'Company Name must be in 20 characters or fewer!'
    });
  }

  if (!companyName) {
    return res.render('signup', { 
      companyName, email: normalizedEmail, 
      error_msg: 'Company Name is required!' 
    });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.render('signup', { 
      companyName, email: normalizedEmail, 
      error_msg: 'Invalid email format!' 
    });
  }

  if (password !== confirmPassword) {
    return res.render('signup', { 
      companyName, email: normalizedEmail, 
      error_msg: 'Passwords do not match!' 
    });
  }

  if (password.length < 4) {
    return res.render('signup', { 
      companyName, email: normalizedEmail, 
      error_msg: 'Password must be at least 4 characters long!' 
    });
  }

  if (password.length > 64) {
    return res.render('signup', { 
      companyName, email: normalizedEmail, 
      error_msg: 'Password must be in 64 characters or fewer!'
    });
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

    const user = await User.findOne({ emailAddress: email });
    if (!user) {
      req.flash('error_msg', 'User does not exist!');
      return res.redirect('/');
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();

    //https://kokapos.onrender.com
    // Send email with reset link
    const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;
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
      subject: 'Password Reset Request',
      html: `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; background-color: #f4f4f4;">
          <div style="background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);">
              <h1 style="font-size: 24px; color: #333; margin-bottom: 20px;">Password Reset</h1>
              <p style="margin-bottom: 20px;">Seems like you forgot your password for <strong>KOKA POS</strong>. If this is true, click below to reset your password.</p>
              
              <a href="${resetUrl}" style="display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; font-size: 16px; margin-bottom: 20px;">Reset My Password</a>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
      </body>
      </html>`
    };
    
    

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        req.flash('error_msg', 'Error sending email.');
      } else {
        req.flash('success_msg', 'Message sent successfully, check your inbox.');
      }
      return res.redirect('/');
    });
  } catch (error) {
    req.flash('error_msg', 'Server error. Please try again.');
    return res.redirect('/');
  }
});

router.post('/staff-forgot-password', async (req, res) => {
  const { email } = req.body;

  try {

    const user = await User.findOne({ emailAddress: email });
    if (!user) {
      req.flash('error_msg', 'User does not exist!');
      return res.redirect('/staff-login');
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();

    //https://kokapos.onrender.com
    // Send email with reset link
    const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;
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
      subject: 'Password Reset Request',
      html: `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; background-color: #f4f4f4;">
          <div style="background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);">
              <h1 style="font-size: 24px; color: #333; margin-bottom: 20px;">Password Reset</h1>
              <p style="margin-bottom: 20px;">Seems like you forgot your password for <strong>KOKA POS</strong>. If this is true, click below to reset your password.</p>
              
              <a href="${resetUrl}" style="display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; font-size: 16px; margin-bottom: 20px;">Reset My Password</a>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
      </body>
      </html>`
    };
    
    

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        req.flash('error_msg', 'Error sending email.');
      } else {
        req.flash('success_msg', 'Message sent successfully, check your inbox.');
      }
      return res.redirect('/staff-login');
    });
  } catch (error) {
    req.flash('error_msg', 'Server error. Please try again.');
    return res.redirect('/staff-login');
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
    user.resetPasswordExpires = Date.now() + 5000;

    await user.save();

    setTimeout(async () => {
      user.resetPasswordExpires = undefined;
      await user.save();
    }, 5000); // 60 seconds timer

    return res.render('reset-password', {
      token, 
      success_msg: 'Password successfully changed!',
      title: "Reset Password",
      hideFooter: true
    });

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
      title: "Reset Password",
      hideFooter: true
    }); // render a form to enter a new password
  } catch (error) {
    res.status(500).send('Server error');
  }
});

module.exports = router;