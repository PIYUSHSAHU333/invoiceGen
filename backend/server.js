const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const cors = require("cors");
const authRoutes = require("./routes/auth");
const invoiceRoutes = require("./routes/invoice");

console.log("--- SERVER.JS STARTING ---");
console.log("MONGO_URI loaded:", process.env.MONGO_URI ? "Yes" : "No");
console.log("JWT_SECRET loaded:", process.env.JWT_SECRET ? "Yes" : "No");
console.log("AWS_S3_BUCKET_NAME loaded:", process.env.AWS_S3_BUCKET_NAME ? "Yes" : "No");

const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

// GLOBAL REQUEST LOGGER - This should hit for EVERY incoming request
app.use((req, res, next) => {
    console.log(`GLOBAL REQUEST LOG: ${req.method} ${req.url} - Headers:`, req.headers); // LOG ALL HEADERS
    next(); // Pass control to the next middleware
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
connectDB();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log("--- SERVER.JS STARTED ---");
});