const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const UserSchema = new Schema({
  googleId: {
    type: String,
    required: true
  },
  emailAddress: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
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
  adminPassword: {
    type: String,
    required: false
  },
  pinResetToken: { 
    type: String
  },
  pinResetExpires: { 
    type: Date
  }
});

module.exports = mongoose.model('User', UserSchema);