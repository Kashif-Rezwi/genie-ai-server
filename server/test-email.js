const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    try {
        // Verify connection
        await transporter.verify();
        console.log('✅ SMTP connection successful');

        // Send test email
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: 'kashifrezwi850@gmail.com', // Replace with your email
            subject: 'Test Email from Genie AI',
            html: '<h1>Email Configuration Working!</h1><p>Your email service is properly configured.</p>',
        });

        console.log('✅ Test email sent:', info.messageId);
    } catch (error) {
        console.error('❌ Email configuration failed:', error);
    }
}

testEmail();