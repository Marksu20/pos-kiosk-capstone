const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const UserSchema = new Schema({
  googleId: {
    type: String,
    required: false
  },
  emailAddress: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: false
  },
  firstName: {
    type: String,
    required: false
  },
  lastName: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  profileImage: {
    type: String,
    required: false
  },
  companyName: {
    type: String,
    required: false
  },
  password: {
    type: String,
  },
  adminPassword: {
    type: String,
    required: false
  },
  pinResetToken: { 
    type: String
  },
  pinResetExpires: { 
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

module.exports = mongoose.model('User', UserSchema);