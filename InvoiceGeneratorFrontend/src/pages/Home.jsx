import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, FileText, LogOut, User, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'; // Import new icons
import axios from 'axios'; // Import axios for API calls

const Home = () => {
    const navigate = useNavigate();

    // State to store user info from localStorage
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    // State to manage the list of generated/pending invoices
    const [generatedInvoices, setGeneratedInvoices] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false); // To disable button during generation

    // Load user info and fetch existing invoices on component mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        console.log('useEffect: Token from localStorage:', token); // DEBUG LOG
        if (!token) {
            navigate('/login');
        } else {
            setUserName(localStorage.getItem('userName') || 'Guest');
            setUserEmail(localStorage.getItem('userEmail') || 'No Email');
            fetchInvoices(token); // Initial fetch

            // Set up polling for invoice status updates
            const intervalId = setInterval(() => {
                fetchInvoices(token); // Poll every 5 seconds for updates
            }, 5000);

            // Clear interval on component unmount
            return () => clearInterval(intervalId);
        }
    }, [navigate]); // navigate is a stable dependency, token is handled inside

    // Function to fetch invoices from backend
    const fetchInvoices = async (token) => {
        try {
            const API = import.meta.env.VITE_API_URL;
            if (!API) throw new Error('API URL is not configured');

            console.log('fetchInvoices: Sending GET request with token:', token); // DEBUG LOG
            const response = await axios.get(`${API}/api/invoices`, {
                headers: {
                    Authorization: `Bearer ${token}` 
                }
            });
           
            const sortedInvoices = response.data.map(invoice => ({
                ...invoice,
                createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date(0)
            })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Use getTime() for numeric comparison
            setGeneratedInvoices(sortedInvoices);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            
        }
    };

    const [clientName, setClientName] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [lineItems, setLineItems] = useState([
        { id: 1, description: '', price: 0, qty: 0, total: '0.00' }
    ]);

    const calculateLineItemTotal = (price, qty) => {
        const p = parseFloat(price);
        const q = parseInt(qty);
        if (isNaN(p) || isNaN(q)) return '0.00';
        return (p * q).toFixed(2);
    };

    const handleLineItemChange = (id, field, value) => {
        setLineItems(prevItems =>
            prevItems.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    updatedItem.total = calculateLineItemTotal(updatedItem.price, updatedItem.qty);
                    return updatedItem;
                }
                return item;
            })
        );
    };

    const addLineItem = () => {
        setLineItems(prevItems => [
            ...prevItems,
            {
                id: prevItems.length > 0 ? Math.max(...prevItems.map(item => item.id)) + 1 : 1,
                description: '',
                price: 0,
                qty: 0,
                total: '0.00'
            }
        ]);
    };

    const removeLineItem = (id) => {
        setLineItems(prevItems => prevItems.filter(item => item.id !== id));
    };

    const invoiceGrandTotal = lineItems.reduce((sum, item) => sum + parseFloat(item.total), 0).toFixed(2);

    const handleGeneratePdf = async (e) => {
        e.preventDefault();

        const finalLineItems = lineItems.filter(item =>
            item.description.trim() !== '' && parseFloat(item.price) > 0 && parseInt(item.qty) > 0
        );

        if (finalLineItems.length === 0) {
            alert('Please add at least one valid line item.');
            return;
        }
        if (!clientName.trim()) {
            alert('Please enter a client name.');
            return;
        }

        setIsGenerating(true);

        const token = localStorage.getItem('token'); // Re-fetching token directly for this action
        console.log('handleGeneratePdf: Token from localStorage for POST:', token); // DEBUG LOG
        if (!token) {
            alert("You are not authenticated. Please log in.");
            setIsGenerating(false);
            navigate('/login');
            return;
        }

        const invoiceData = {
            clientName,
            invoiceDate,
            lineItems: finalLineItems.map(item => ({ // Ensure data types match backend model
                description: item.description,
                price: parseFloat(item.price),
                qty: parseInt(item.qty),
                total: parseFloat(item.total)
            })),
            grandTotal: parseFloat(invoiceGrandTotal)
        };

        try {
            const API = import.meta.env.VITE_API_URL;
            if (!API) throw new Error('API URL is not configured');

            console.log('handleGeneratePdf: Sending POST request with token:', token); // DEBUG LOG
            const response = await axios.post(`${API}/api/invoices`, invoiceData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            console.log("Backend Response Data:", response.data);

            const { invoice: newBackendInvoice } = response.data;
            const formattedNewInvoice = {
                ...newBackendInvoice,
                createdAt: newBackendInvoice.createdAt ? new Date(newBackendInvoice.createdAt) : new Date(0)
            };

            setGeneratedInvoices(prev => {
                // Filter out any *old* entry with the same _id (important for polling updates)
                // Then add the new/updated entry and sort the entire list by createdAt.
                return [
                    formattedNewInvoice,
                    ...prev.filter(inv => inv._id !== formattedNewInvoice._id)
                ].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
            });

            console.log(response.data.message);

            // Clear the form fields
            setClientName('');
            setLineItems([{ id: 1, description: '', price: 0, qty: 0, total: '0.00' }]);

        } catch (error) {
            console.error("PDF Generation Error:", error);
            if (error.response?.status === 401) {
                alert("Session expired. Please log in again.");
                handleLogout();
            } else {
                alert(`Failed to initiate invoice generation: ${error.response?.data?.message || error.message}`);
            }
        } finally {
            setIsGenerating(false);
            // A polling mechanism (already implemented in useEffect) will update the status
            // after the backend has finished PDF generation.
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        navigate('/login');
    };

    // Function to handle download click
    const handleDownloadPdf = async (invoiceId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert("You are not authenticated. Please log in.");
            navigate('/login');
            return;
        }

        try {
            const API = import.meta.env.VITE_API_URL;
            if (!API) throw new Error('API URL is not configured');

            const response = await axios.get(`${API}/api/invoices/${invoiceId}/download`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const s3PreSignedUrl = response.data.downloadUrl;

            if (s3PreSignedUrl) {
                window.open(s3PreSignedUrl, '_blank');
                console.log("Download initiation successful. Check your browser's downloads.");
            } else {
                alert("Failed to get PDF download link from server: URL missing.");
                console.error("Backend response for PDF download missing 'downloadUrl'.", response.data);
            }

        } catch (error) {
            console.error("Error downloading PDF:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                alert("Authorization failed. Please log in again or check permissions.");
                handleLogout();
            } else if (error.response?.data?.message) {
                alert(`Download failed: ${error.response.data.message}`);
            } else {
                alert("Failed to download PDF. Please try again. (Check backend logs for more details)");
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            {/* User Navbar */}
            <div className="w-full max-w-4xl bg-purple-600 text-white p-4 rounded-t-lg shadow-md flex items-center justify-between">
                <div className="flex items-center">
                    <User size={20} className="mr-2" />
                    <div>
                        <span className="font-semibold text-lg">{userName}</span>
                        <span className="block text-sm opacity-80">{userEmail}</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded-md transition-colors duration-200"
                >
                    <LogOut size={18} className="mr-2" />
                    Logout
                </button>
            </div>

            <div className="w-full max-w-4xl bg-white rounded-b-lg shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
                    Create New Invoice
                </h1>

                <form onSubmit={handleGeneratePdf} className="space-y-6">
                    {/* Client Information Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                                Client Name
                            </label>
                            <input
                                type="text"
                                id="clientName"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Enter client name"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 mb-1">
                                Invoice Date
                            </label>
                            <input
                                type="date"
                                id="invoiceDate"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Line Items Table Section */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Line Items</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">#</th><th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Description</th><th className="px-4 py-2 text-left text-sm font-medium text-gray-600 w-24">Price</th><th className="px-4 py-2 text-left text-sm font-medium text-gray-600 w-20">Qty</th><th className="px-4 py-2 text-left text-sm font-medium text-gray-600 w-28">Total</th><th className="px-4 py-2 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, index) => (
                                        <tr key={item.id} className="border-t border-gray-200">
                                            <td className="px-4 py-2 text-sm text-gray-800">{index + 1}</td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                                    className="w-full p-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                                                    placeholder="Item description"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => handleLineItemChange(item.id, 'price', e.target.value)}
                                                    className="w-full p-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => handleLineItemChange(item.id, 'qty', e.target.value)}
                                                    className="w-full p-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                                                    min="1"
                                                    step="1"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-800 font-semibold">
                                                Rs.{item.total}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeLineItem(item.id)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan="6" className="pt-4 text-right">
                                            <button
                                                type="button"
                                                onClick={addLineItem}
                                                className="flex items-center justify-center px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-sm font-medium"
                                            >
                                                <PlusCircle size={18} className="mr-2" /> Add Line Item
                                            </button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan="4" className="px-4 py-2 text-right text-lg font-bold text-gray-800">
                                            Grand Total:
                                        </td>
                                        <td colSpan="2" className="px-4 py-2 text-left text-lg font-bold text-gray-800">
                                            Rs.{invoiceGrandTotal}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Generate PDF Button */}
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-lg font-semibold mt-8"
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={20} className="mr-2 animate-spin" /> Generating...
                            </>
                        ) : (
                            <>
                                <FileText size={20} className="mr-2" /> Generate PDF
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* List of Generated Invoices */}
            <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                    Recent Invoices
                </h2>
                {generatedInvoices.length === 0 ? (
                    <p className="text-center text-gray-500">No invoices generated yet.</p>
                ) : (
                    <div className="space-y-4">
                        {generatedInvoices.map(invoice => (
                            <div key={invoice._id} className="p-4 border border-gray-200 rounded-md shadow-sm flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-lg font-semibold text-gray-800">{invoice.clientName}</p>
                                    <p className="text-sm text-gray-600">Date: {new Date(invoice.invoiceDate).toLocaleDateString()} | Total: Rs.{invoice.grandTotal.toFixed(2)}</p>
                                    <p className={`text-sm font-medium ${
                                        invoice.status === 'processing' ? 'text-blue-600' :
                                        invoice.status === 'completed' ? 'text-green-600' :
                                        'text-red-600'
                                    }`}>
                                        Status: {invoice.status === 'completed' ? 'Ready' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                    </p>
                                </div>
                                <div className="ml-4">
                                    {invoice.status === 'processing' && (
                                        <Loader2 size={24} className="animate-spin text-blue-500" title="Processing..." />
                                    )}
                                    {invoice.status === 'completed' && invoice.pdfUrl && (
                                        <button
                                            onClick={() => handleDownloadPdf(invoice._id)}
                                            className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium"
                                            title="Download PDF"
                                        >
                                            <Download size={18} className="mr-1" /> PDF
                                        </button>
                                    )}
                                    {invoice.status === 'failed' && (
                                        <XCircle size={24} className="text-red-500" title="PDF generation failed." />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;