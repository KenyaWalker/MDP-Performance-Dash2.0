const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files - for Render deployment, files are in root directory
app.use(express.static(path.join(__dirname, '../')));
console.log('✅ Serving static files from root directory');

// Simple JSON file storage
const dataFile = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Helper function to read data
const readData = () => {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data:', error);
        return [];
    }
};

// Helper function to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
};

// Email configuration
const createEmailTransporter = () => {
    // Using Gmail as default - can be changed to other providers
    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com', // Set via environment variable
            pass: process.env.EMAIL_PASS || 'your-app-password'     // Set via environment variable
        }
    });
};

// Helper function to send email
const sendSurveyEmail = async (surveyData) => {
    if (!surveyData.emailResponse || !surveyData.respondentEmail) {
        return { success: false, message: 'Email not requested' };
    }

    try {
        const transporter = createEmailTransporter();
        
        // Format the survey responses for email
        const emailContent = `
MDP Performance Evaluation Summary

MDP: ${surveyData.mdpName}
Function: ${surveyData.functionName}
Manager: ${surveyData.manager}
Rotation: ${surveyData.rotation}
Submitted: ${new Date(surveyData.submittedAt).toLocaleString()}

PERFORMANCE SCORES:
• Job Knowledge: ${surveyData.jobKnowledge}/5
• Quality of Work: ${surveyData.qualityOfWork}/5
• Communication & Teamwork: ${surveyData.communication}/5
• Initiative & Productivity: ${surveyData.initiative}/5
• Overall Score: ${surveyData.overall}/5

Thank you for completing the MDP Performance Evaluation!

---
Sam's Club Merchandising Development Program
        `.trim();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@samsclub.com',
            to: surveyData.respondentEmail,
            subject: `MDP Performance Evaluation - ${surveyData.mdpName}`,
            text: emailContent
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, message: 'Failed to send email', error: error.message };
    }
};

// API Routes
app.get('/api/survey-responses', (req, res) => {
    const data = readData();
    res.json(data);
});

app.post('/api/survey-responses', (req, res) => {
    try {
        const data = readData();
        
        // Normalize manager name
        const normalizedManager = req.body.manager.trim().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
        // Calculate auto-rotation based on existing surveys for this MDP
        const existingSurveys = data.filter(item => 
            item.mdpName === req.body.mdpName
        ).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        
        const nextRotation = existingSurveys.length + 1;
        
        // Check if this rotation already exists (prevent duplicates)
        const rotationExists = existingSurveys.some(survey => survey.rotation === nextRotation);
        if (rotationExists) {
            return res.status(400).json({ 
                error: `Rotation ${nextRotation} already exists for ${req.body.mdpName}. Only one survey per rotation allowed.` 
            });
        }
        
        // Check if this function has already been completed (prevent duplicate functions)
        const functionAlreadyCompleted = existingSurveys.some(survey => survey.functionName === req.body.functionName);
        if (functionAlreadyCompleted) {
            return res.status(400).json({ 
                error: `${req.body.mdpName} has already completed the ${req.body.functionName} function. Please select a different function.` 
            });
        }
        
        const newResponse = {
            id: Date.now().toString(),
            ...req.body,
            manager: normalizedManager, // Use normalized manager name
            rotation: nextRotation, // Auto-calculated rotation
            submittedAt: new Date().toISOString()
        };
        
        data.push(newResponse);
        
        if (writeData(data)) {
            // Send email if requested
            if (newResponse.emailResponse && newResponse.respondentEmail) {
                sendSurveyEmail(newResponse).then(emailResult => {
                    if (emailResult.success) {
                        console.log(`Email sent successfully to ${newResponse.respondentEmail}`);
                    } else {
                        console.error(`Failed to send email: ${emailResult.message}`);
                    }
                }).catch(error => {
                    console.error('Email sending error:', error);
                });
            }
            
            res.status(201).json(newResponse);
        } else {
            res.status(500).json({ error: 'Failed to save data' });
        }
    } catch (error) {
        console.error('Error saving survey response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/survey-responses/:id', (req, res) => {
    try {
        const data = readData();
        const filteredData = data.filter(item => item.id !== req.params.id);
        
        if (writeData(filteredData)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to delete data' });
        }
    } catch (error) {
        console.error('Error deleting survey response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve admin panel
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, '../admin.html');
    res.sendFile(adminPath);
});

// Serve main survey form for all other routes
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../index.html');
    res.sendFile(indexPath);
});

app.listen(PORT, () => {
    console.log(`🚀 MDP Dashboard Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api/survey-responses`);
    console.log(`👩‍💼 Admin Panel available at http://localhost:${PORT}/admin`);
});