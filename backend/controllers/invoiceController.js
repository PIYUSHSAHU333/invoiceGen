const Invoice = require('../models/invoice.js');
const PDFDocument = require('pdfkit'); 
const fs = require('fs'); 
const path = require('path'); 
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// --- Rate Limiting Configuration (In-Memory) ---
const userRequestTimestamps = new Map(); // Stores userId -> [timestamp1, timestamp2, ...]
const RATE_LIMIT_COUNT = 5; // Max 5 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // Per 1 minute (60,000 milliseconds)

const generateInvoicePdf = async (invoiceData, outputPath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);

        doc.fontSize(25).text('Invoice', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text(`Client Name: ${invoiceData.clientName}`);
        doc.text(`Invoice Date: ${invoiceData.invoiceDate.toDateString()}`);
        doc.moveDown();

        
        const tableTop = doc.y;
        const itemX = 50;
        const descX = 150;
        const qtyX = 350;
        const priceX = 400;
        const totalX = 470;

        doc.fontSize(10)
            .text('Description', descX, tableTop, { width: 180, align: 'left' })
            .text('Qty', qtyX, tableTop, { width: 50, align: 'center' })
            .text('Price (Rs.)', priceX, tableTop, { width: 70, align: 'right' })
            .text('Total (Rs.)', totalX, tableTop, { width: 70, align: 'right' });

        doc.moveTo(itemX, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).stroke();

        let currentY = tableTop + 35;
        invoiceData.lineItems.forEach(item => {
            doc.fontSize(10)
                .text(item.description, descX, currentY, { width: 180, align: 'left' })
                .text(item.qty, qtyX, currentY, { width: 50, align: 'center' })
                .text(item.price.toFixed(2), priceX, currentY, { width: 70, align: 'right' })
                .text(item.total.toFixed(2), totalX, currentY, { width: 70, align: 'right' });
            currentY += 20;
        });

        doc.moveTo(itemX, currentY + 10).lineTo(doc.page.width - 50, currentY + 10).stroke();

        doc.moveDown();
        doc.fontSize(14).text(`Grand Total: Rs.${invoiceData.grandTotal.toFixed(2)}`, { align: 'right' });

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

const generateInvoicePdfBuffer = async (invoiceData) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });
        doc.on('error', reject);

        doc.fontSize(25).text('Invoice', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text(`Client Name: ${invoiceData.clientName}`);
        doc.text(`Invoice Date: ${invoiceData.invoiceDate.toDateString()}`);
        doc.moveDown();

        const tableTop = doc.y;
        const descX = 50;
        const qtyX = 300;
        const priceX = 380;
        const totalX = 460;

        doc.fontSize(10)
            .text('Description', descX, tableTop, { width: 200, align: 'left' })
            .text('Qty', qtyX, tableTop, { width: 50, align: 'center' })
            .text('Price (Rs.)', priceX, tableTop, { width: 70, align: 'right' })
            .text('Total (Rs.)', totalX, tableTop, { width: 70, align: 'right' });

        doc.moveTo(descX, tableTop + 20).lineTo(doc.page.width - 50, tableTop + 20).stroke();

        let currentY = tableTop + 35;
        invoiceData.lineItems.forEach(item => {
            doc.fontSize(10)
                .text(item.description, descX, currentY, { width: 200, align: 'left' })
                .text(item.qty.toString(), qtyX, currentY, { width: 50, align: 'center' })
                .text(item.price.toFixed(2), priceX, currentY, { width: 70, align: 'right' })
                .text(item.total.toFixed(2), totalX, currentY, { width: 70, align: 'right' });
            currentY += 20;
        });

        doc.moveTo(descX, currentY + 10).lineTo(doc.page.width - 50, currentY + 10).stroke();

        doc.moveDown(1.9);

        const grandTotalText = `Grand Total: Rs.${invoiceData.grandTotal.toFixed(2)}`;
        const grandTotalStartX = priceX;
        const grandTotalAvailableWidth = (doc.page.width - 50) - grandTotalStartX;

        doc.fontSize(12).text(grandTotalText, grandTotalStartX, doc.y, {
            align: 'right',
            width: grandTotalAvailableWidth
        });

        doc.end();
    });
};

exports.createInvoice = async (req, res) => {
    const { clientName, invoiceDate, lineItems, grandTotal } = req.body;
    const userId = req.user.id;

    // --- Rate Limiting Logic ---
    const now = Date.now();
    let timestamps = userRequestTimestamps.get(userId) || [];

    // Clean up old timestamps (outside the window)
    timestamps = timestamps.filter(timestamp => (now - timestamp) < RATE_LIMIT_WINDOW_MS);

    if (timestamps.length >= RATE_LIMIT_COUNT) {
        console.warn(`Rate limit exceeded for user ${userId}. Requests in window: ${timestamps.length}`);
        return res.status(429).json({ message: 'Too many PDF generation requests. Please try again in a minute.' });
    }

    // Add current request timestamp
    timestamps.push(now);
    userRequestTimestamps.set(userId, timestamps);
    // --- End Rate Limiting Logic ---

    let newInvoice;

    try {
        newInvoice = new Invoice({
            userId,
            clientName,
            invoiceDate: new Date(invoiceDate),
            lineItems,
            grandTotal,
            status: 'processing' // Initial status
        });

        await newInvoice.save();

        res.status(202).json({
            message: 'Invoice processing initiated. Status will update shortly.',
            invoice: {
                _id: newInvoice._id,
                clientName: newInvoice.clientName,
                invoiceDate: newInvoice.invoiceDate,
                grandTotal: newInvoice.grandTotal,
                status: newInvoice.status,
                pdfUrl: newInvoice.pdfUrl,
                createdAt: newInvoice.createdAt
            }
        });

    } catch (error) {
        console.error('Error during initial invoice save:', error);
        // Remove the timestamp if the request failed before a 202 was successfully sent
        timestamps = timestamps.filter(ts => ts !== now);
        userRequestTimestamps.set(userId, timestamps);
        return res.status(500).json({ message: 'Server error during initial invoice save.', error: error.message });
    }

    (async () => {
        const pdfFileName = `invoice_${newInvoice._id}.pdf`;
        const s3Key = `invoices/${pdfFileName}`; // Path inside your S3 bucket

        try {
            const pdfBuffer = await generateInvoicePdfBuffer(newInvoice);

            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: s3Key,
                    Body: pdfBuffer,
                    ContentType: 'application/pdf',
                },
            });

            const data = await upload.done();
            newInvoice.pdfUrl = s3Key;
            newInvoice.status = 'completed';
            await newInvoice.save();
            console.log(`PDF generated and uploaded to S3: s3://${process.env.AWS_S3_BUCKET_NAME}/${s3Key}`);

        } catch (pdfError) {
            console.error(`Error generating or uploading PDF for invoice ${newInvoice._id}:`, pdfError);
            newInvoice.status = 'failed';
            newInvoice.pdfUrl = null;
            await newInvoice.save();
        }
    })();
};

exports.getInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ message: 'Server error fetching invoices.', error: error.message });
    }
};

exports.downloadInvoicePdf = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found.' });
        }

        if (invoice.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Not authorized to download this invoice.' });
        }

        if (invoice.status !== 'completed' || !invoice.pdfUrl) {
            return res.status(404).json({ message: 'PDF not available or still processing.' });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: invoice.pdfUrl,
        });

        const expiresInSeconds = 300;
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

        console.log("Backend: Sending pre-signed URL in JSON response:", signedUrl);

        res.json({ downloadUrl: signedUrl });

    } catch (error) {
        console.error('Error getting pre-signed URL for invoice PDF:', error);
        res.status(500).json({ message: 'Server error generating PDF download link.', error: error.message });
    }
}; 