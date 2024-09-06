const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  item: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model('Stock', stockSchema);