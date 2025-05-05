const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const receiptSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  orderNumber: { 
    type: String,
    required: true,
  },
  customerName: { 
    type: String, 
    required: false 
  },
  orderItems: [
    {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: {type: String, required: true},
      price: {type: Number, required: true},
      quantity: {type: Number, required: true},
    }
  ],
  orderType: { 
    type: String, 
    enum: ['Dine In', 'Takeout'], 
    required: false 
  },
  totalAmount: { 
    type: Number, 
    required: false 
  },
  subTotal: {
    type: Number,
  },
  discount: { 
    type: Number, 
    default: 0 
  },
  paymentMethod: {
    type: String
  },
  cashier: {
    type: String,
    required: false
  },
  companyName: {
    type: String,
    required: false
  },
  status: {
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

module.exports = mongoose.model('Receipt', receiptSchema);