const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const logSchema = new Schema({
    message: {
        type: String,
        required: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    user: {
        type: Schema.ObjectId,
        ref: 'User',
        required: false
    },
    action: {
        type: String,
        required: false,
    },
    productName: {
        type: String,
        required: false
    },
    newValue: {
        type: String,
        required: false
    },
    categoryName: {
        type: String,
        required: false
    },
    comment: {
        type: String,
        required: false
    },
    formmatedDate: {
        type: String,
        required: false
    },
});

module.exports = mongoose.model('Log', logSchema);