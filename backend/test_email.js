const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'amtwork23@gmail.com',
        pass: 'qigimldzcdnwbspz'
    }
});

transporter.sendMail({
    from: 'amtwork23@gmail.com',
    to: 'amtwork23@gmail.com',
    subject: 'Test',
    text: 'Hello from CampusPulse!'
})
    .then(info => console.log('✅ Email sent:', info.response))
    .catch(err => console.error('❌ Error:', err));