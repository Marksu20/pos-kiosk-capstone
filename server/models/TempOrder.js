const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tempOrderSchema = new Schema({
    paypalOrderId: {
        type: String,
        required: true
    },
    accountId: {
        type: String,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    orderType: {
        type: String,
        enum: ['Dine In', 'Takeout'],
        required: true
    },
    orderItems: [
        {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true }
        }
    ],
    status: {
        type: String,
        default: 'Pending'
    },

})

module.exports = mongoose.model('TempOrder', tempOrderSchema);