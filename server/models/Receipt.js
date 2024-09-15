const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const receiptSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  orderNumber: { 
    type: String, 
    unique: true 
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
    required: true 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  discount: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

module.exports = mongoose.model('Receipt', receiptSchema);