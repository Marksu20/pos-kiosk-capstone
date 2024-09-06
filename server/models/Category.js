const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categorySchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model('Category', categorySchema);

