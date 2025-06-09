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

        doc.moveDown();
        doc.fontSize(14).text(`Grand Total: Rs.${invoiceData.grandTotal.toFixed(2)}`, { align: 'right' });

        doc.end();
    });
};

exports.createInvoice = async (req, res) => {
    const { clientName, invoiceDate, lineItems, grandTotal } = req.body;
    const userId = req.user.id; 

    try {
        
        const newInvoice = new Invoice({
            userId,
            clientName,
            invoiceDate: new Date(invoiceDate), // Ensure date is correctly parsed
            lineItems,
            grandTotal,
            status: 'processing'
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

        
        const pdfBuffer = await generateInvoicePdfBuffer(newInvoice); // Get PDF as buffer

        const s3Key = `invoices/${newInvoice._id}.pdf`;

        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: s3Key, // The file name/path in S3
                Body: pdfBuffer,
                ContentType: 'application/pdf',
            },
        });

        upload.on('httpUploadProgress', (progress) => {
            // You can log upload progress if needed
            // console.log(progress);
        });

        const data = await upload.done(); // Perform the upload
        const s3PublicUrl = data.Location; // Get the public URL from S3

        // Update invoice status and pdfUrl upon successful generation & upload
        newInvoice.status = 'completed';
        newInvoice.pdfUrl = s3Key; // Store the S3 Key (e.g., "invoices/invoice_ID.pdf")
        await newInvoice.save();
        console.log(`PDF generated and uploaded to S3: s3://${process.env.AWS_S3_BUCKET_NAME}/${s3Key}`);

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ message: 'Server error during invoice creation.', error: error.message });
    }
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