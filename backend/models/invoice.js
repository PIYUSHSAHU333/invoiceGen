const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 } 
}, { _id: false }); 

const InvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    clientName: {
        type: String,
        required: true,
        trim: true
    },
    invoiceDate: {
        type: Date,
        required: true
    },
    lineItems: [LineItemSchema],
    grandTotal: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    pdfUrl: {
        type: String,
        default: null
    },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);

