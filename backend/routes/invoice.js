const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

console.log("--- INVOICE ROUTES FILE LOADED ---");

router.post('/', authMiddleware, invoiceController.createInvoice);


router.get('/', authMiddleware, invoiceController.getInvoices);


router.get('/:id/download', authMiddleware, invoiceController.downloadInvoicePdf);

module.exports = router;
