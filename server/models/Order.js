const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
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
    required: true 
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
  discount: { 
    type: Number, 
    default: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    required: true
  },
})

module.exports = mongoose.model('Order', orderSchema);