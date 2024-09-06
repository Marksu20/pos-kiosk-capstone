const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  image: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true
  },
  category:{
    type: Schema.ObjectId,
    ref: 'Category' ,
    required: true,
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: false,
    default: 0
  },
  sold: {
    type: Number,
    required: false,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model('Product', ProductSchema);