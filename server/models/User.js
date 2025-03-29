const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const UserSchema = new Schema({
  googleId: {
    type: String,
    required: false
  },
  emailAddress: {
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: false,
    unique: true
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
  },
  role: {
    type: String,
    enum: ['admin', 'sub-admin', 'cashier'],
    default: 'cashier'
  },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    
  }
}, { autoIndex: false});

UserSchema.index({ emailAddress: 1}, {unique: true});
module.exports = mongoose.model('User', UserSchema);