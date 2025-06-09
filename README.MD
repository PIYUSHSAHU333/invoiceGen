# PDF Invoice Generator

This project is a web application that allows authenticated users to generate PDF invoices. It consists of a React frontend and a Node.js/Express backend, utilizing MongoDB for data storage and AWS S3 for secure PDF storage.

## Features

*   User Authentication (Register, Login, Logout)
*   Invoice Creation with dynamic line items
*   Asynchronous PDF Generation
*   Secure PDF Storage on AWS S3 with pre-signed URLs
*   Rate Limiting for PDF generation
*   Responsive UI with Tailwind CSS

## Technologies Used

### Frontend
*   React.js
*   Vite
*   React Router DOM
*   Axios
*   Tailwind CSS
*   Lucide React (Icons)

### Backend
*   Node.js
*   Express.js
*   MongoDB (via Mongoose)
*   JWT (JSON Web Tokens) for authentication
*   Bcrypt.js for password hashing
*   PDFKit for PDF generation
*   AWS SDK for JavaScript (S3 client, S3 request presigner)
*   Dotenv for environment variables
*   Express-Async-Handler for error handling

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: [Download & Install Node.js](https://nodejs.org/en/download/) (LTS version recommended)
*   **npm** (comes with Node.js) or **Yarn**: [Install Yarn](https://classic.yarnpkg.com/en/docs/install/)
*   **Git**: [Download & Install Git](https://git-scm.com/downloads)
*   **MongoDB Atlas Account**: For your database. [Sign Up for MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
*   **AWS Account**: For S3 storage. [Sign Up for AWS](https://aws.amazon.com/free/)

## Local Setup Instructions

Follow these steps to get the project up and running on your local machine.

### 1. Clone the Repository

First, clone the project from GitHub:

```bash
git clone https://github.com/PIYUSHSAHU333/invoiceGen.git
cd pdf-invoice-generator
```

### 2. Backend Setup (`backend` directory)

Navigate into the `backend` directory:

```bash
cd backend
```

#### a. Install Dependencies

Install all necessary Node.js packages for the backend:

```bash
npm install
# or
yarn install
```

#### b. Environment Variables (`.env` file)

Create a `.env` file in the `backend` directory (i.e., `pdf-invoice-generator/backend/.env`) and add the following variables. Replace the placeholder values with your actual credentials and configurations.

```env
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=a_very_strong_and_random_secret_key_for_jwt_signing
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_s3_bucket_region # e.g. eu-north-1
AWS_S3_BUCKET_NAME=your_s3_bucket_name # e.g. invoicegenerator-piyushsahu2025
```

**How to get these values:**

*   **`MONGO_URI`**:
    1.  Log in to your MongoDB Atlas account.
    2.  Navigate to your cluster.
    3.  Click "Connect".
    4.  Choose "Connect your application".
    5.  Copy the connection string. Replace `<password>` with your database user's password and ensure your IP address is whitelisted in Network Access.
*   **`JWT_SECRET`**: Generate a long, random string. You can use an online generator or a simple script.
*   **`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`**:
    1.  **AWS S3 Bucket:**
        *   Log in to the AWS Management Console.
        *   Go to **S3**. Click "Create bucket".
        *   **Bucket name:** Enter a unique name (e.g., `invoicegenrator-yourname`).
        *   **AWS Region:** Choose a region (e.g., `eu-north-1`). Note this down for `AWS_REGION`.
        *   **Block Public Access settings for this bucket:** KEEP THIS **ENABLED** (i.e., "Block all public access" should be checked). We will use pre-signed URLs for secure downloads.
        *   Click "Create bucket".
        *   Once created, go to your bucket, then **Permissions** tab, then **CORS configuration**. Add the following JSON, replacing `http://localhost:5173` with your frontend's exact origin if different:
            ```json
            [
                {
                    "AllowedHeaders": [
                        "*"
                    ],
                    "AllowedMethods": [
                        "GET"
                    ],
                    "AllowedOrigins": [
                        "http://localhost:5173"
                    ],
                    "ExposeHeaders": [],
                    "MaxAgeSeconds": 3000
                }
            ]
            ```
            (Note: While the primary download method avoids direct browser S3 CORS, this is good practice for future needs if you ever fetch directly.)
    2.  **AWS IAM User:**
        *   In the AWS Console, search for **IAM**.
        *   Go to **Users** -> **Create user**.
        *   **User name:** `PDFInvoiceGenerator` (or similar).
        *   **Access key - Programmatic access:** Check this box.
        *   **Permissions:** Select "Attach policies directly". Search for `S3` and select `AmazonS3FullAccess`.
        *   Complete user creation. On the final step, **copy the `Access key ID` and `Secret access key` immediately**. These are your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. You won't see the secret key again.

#### c. Run the Backend Server

Once `.env` is configured, start the backend server:

```bash
npm start
# or
yarn start
```
The server should start on `http://localhost:3000`.

#### d. CORS Configuration (Important for Production)

The backend (`server.js`) uses the `cors` middleware configured to allow requests from **all origins** (`app.use(cors());`). This is convenient for local development as your frontend might run on a different port (e.g., `5173`) than your backend (`3000`).

**For a production environment, it is a security best practice to restrict CORS to only your specific frontend domain(s).**

If you deploy your frontend to, for example, `https://your-invoice-app.com`, you should update your `server.js` in the backend as follows:

```javascript
// In pdf-invoice-generator/backend/server.js
// ...
const cors = require('cors');

const corsOptions = {
  origin: 'http://localhost:5173', // For local development
  // In production, change this to your deployed frontend URL:
  // origin: 'https://your-invoice-app.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Adjust as needed for your API
  credentials: true // Allow cookies/authorization headers
};

app.use(cors(corsOptions));
// ...
```
Remember to uncomment and update the `origin` in `corsOptions` with your actual frontend domain when you prepare for production deployment.

### 3. Frontend Setup (`InvoiceGeneratorFrontend` directory)

Open a **new terminal window** and navigate into the `InvoiceGeneratorFrontend` directory:

```bash
cd ../InvoiceGeneratorFrontend
```

#### a. Install Dependencies

Install all necessary Node.js packages for the frontend:

```bash
npm install
# or
yarn install
```

#### b. Tailwind CSS Setup

Ensure Tailwind CSS is correctly set up. If you followed previous instructions, this should be done. If not, here's a quick recap (assuming Vite):

1.  **Install Tailwind PostCSS**
    ```bash
    npm install -D tailwindcss @tailwindcss/vite
    ```
2.  **Modify your config to include the Tailwind plugin:**
    ```
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    import tailwind from '@tailwindcss/vite'

    export default defineConfig({
    plugins: [
    react(),
    tailwind(),  
  ],
})
    ```
3.  **Create or update your global CSS file (e.g., src/index.css):**: 
    ```
    @import "tailwindcss";

    ```

#### c. Environment Variables (`.env` file)

Create a `.env` file in the `InvoiceGeneratorFrontend` directory (i.e., `pdf-invoice-generator/InvoiceGeneratorFrontend/.env`) and add the following:

```env
VITE_API_URL=http://localhost:3000
```

#### d. Run the Frontend Development Server

Start the React development server:

```bash
npm run dev
# or
yarn dev
```
The frontend should now be accessible at `http://localhost:5173` (or another port if Vite chooses a different one).

## Running the Application

1.  Ensure your **backend server** is running (from step 2.c).
2.  Ensure your **frontend development server** is running (from step 3.d).
3.  Open your browser and navigate to `http://localhost:5173`.

## Usage

1.  **Register:** Create a new user account.
2.  **Login:** Log in with your registered credentials.
3.  **Invoice Dashboard:** You'll be redirected to the home page (dashboard).
4.  **Create Invoice:** Fill out the client details and add line items.
5.  **Generate PDF:** Click "Generate PDF". The invoice will appear in the list with a "Processing..." status.
6.  **Download PDF:** Once the status updates to "Ready" (it polls every 5 seconds), a "Download PDF" button will appear. Click it to securely download the generated invoice.



##Architectural decisions:

1. **System Design & Architecture**
The end-to-end flow from clicking "Generate PDF" is asynchronous. When a user clicks "Generate PDF," the frontend immediately sends the invoice data to the backend and updates its UI to "Processing..." without waiting for the PDF to be fully generated. The backend then saves the invoice metadata to MongoDB and initiates the CPU-intensive PDF generation and S3 upload in the background, returning an immediate 202 Accepted response to the frontend. This architectural choice is critical because PDF generation is a computationally heavy, CPU-bound task; if it were synchronous, it would block Node.js's single event loop, making the server unresponsive to other user requests and leading to a poor user experience (freezing UIs, timeouts, and poor scalability). By offloading this task and responding asynchronously, the server remains free to handle subsequent requests, ensuring high responsiveness and allowing the service to scale efficiently even when many users are generating invoices concurrently.

2. **Security & Robustness**
Our system ensures User A cannot download User B's invoice through a robust authentication and authorization flow: when User A requests an invoice download, their unique JSON Web Token (JWT) is sent to the backend, where authMiddleware verifies its authenticity and extracts User A's ID. The downloadInvoicePdf controller then strictly checks if the userId associated with the requested invoice in the database matches the ID from User A's token; if not, access is denied. Furthermore, all PDFs in AWS S3 are kept private, and a temporary, pre-signed download URL is only generated by the backend and issued to the frontend after this authorization check passes. 
The rate-limiting mechanism is currently implemented using an in-memory Map (userRequestTimestamps) on the backend, storing request timestamps per user and filtering out old requests to count recent generations, preventing a user from exceeding 5 PDFs per minute. However, this in-memory solution does not scale across multiple servers, as each server instance would maintain its own independent state; to handle scaling, the rate-limiting state would need to be centralized in a persistent, shared store like Redis, ensuring consistent limits regardless of which server instance a user hits.

3. **Code Quality & Best Practices**
Yes, the code is generally clean, organized, and easy to understand, with effective separation of concerns between the frontend and backend. The frontend (InvoiceGeneratorFrontend) clearly handles all user interface logic, state management, and interaction, making API calls to the backend. The backend (backend) is structured with distinct Mongoose models for data definition, Express routes for API endpoints, and controllers to encapsulate business logic (authentication, database operations, PDF generation, and S3 interaction), along with dedicated middleware for authentication and rate limiting. Although the PDF generation itself runs on the main backend thread for simplicity in this project, the architectural choice to make this process asynchronous from the user's perspective and return an immediate response demonstrates a conceptual separation of concerns for CPU-bound tasks, allowing the main server to remain responsive while heavy lifting is handled, making the overall system modular and maintainable.

4. **User Experience**
Yes, the application works as expected for the user, delivering on its core functionalities. The asynchronous flow for PDF generation is indeed smooth: when a user clicks "Generate PDF," the UI immediately updates with a "Processing..." status, providing instant feedback without freezing the interface. This allows the user to continue interacting with the application or create new invoices while the backend handles the resource-intensive PDF generation in the background. The frontend's polling mechanism ensures that once the PDF is ready on the server, the invoice status automatically updates to "Ready" and the "Download PDF" link appears without requiring a page refresh, resulting in a responsive and intuitive user experience that clearly communicates progress and avoids frustrating delays.

Enjoy generating invoices!


