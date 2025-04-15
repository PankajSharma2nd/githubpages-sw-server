// This is a Node.js backend example for handling push notifications
// This would need to be hosted on a separate server, not on GitHub Pages
// GitHub Pages only serves static content

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// VAPID keys generation
// Run this once and save the keys
/*
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
*/

// Your VAPID keys (replace with your actual keys)
const publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY';
const privateVapidKey = 'YOUR_PRIVATE_VAPID_KEY';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  publicVapidKey,
  privateVapidKey
);

// Store subscriptions (in a real app, use a database)
const subscriptions = [];
const pageVisits = [];

// Endpoint to save subscription
app.post('/subscribe', (req, res) => {
  const subscription = req.body.subscription;
  const pageUrl = req.body.pageUrl;
  
  console.log('Subscription received:', subscription);
  console.log('Page URL:', pageUrl);
  
  // Store subscription
  subscriptions.push(subscription);
  
  // Write to file as a simple persistence solution
  fs.writeFileSync(
    path.join(__dirname, 'subscriptions.json'),
    JSON.stringify(subscriptions, null, 2)
  );
  
  res.status(201).json({ message: 'Subscription added successfully' });
});

// Endpoint to receive page visit data from service worker
app.post('/pageview', (req, res) => {
  const data = req.body;
  console.log('Page visit recorded:', data);
  
  // Store page visit
  pageVisits.push(data);
  
  // Write to file
  fs.writeFileSync(
    path.join(__dirname, 'pagevisits.json'),
    JSON.stringify(pageVisits, null, 2)
  );
  
  res.status(200).json({ message: 'Page visit recorded' });
});

// Endpoint to trigger push notification to all subscribers
app.post('/send-notification', (req, res) => {
  const { title, body, url } = req.body;
  
  if (!title || !body) {
    return res.status(400).json({ message: 'Title and body are required' });
  }
  
  const notificationPayload = {a
    title: title,
    body: body,
    url: url || 'https://yourusername.github.io/'
  };
  
  // Array of promises for each push notification
  const sendPromises = subscriptions.map(subscription => {
    return webpush.sendNotification(
      subscription,
      JSON.stringify(notificationPayload)
    ).catch(error => {
      console.error('Error sending notification to a subscription:', error);
      // If the subscription is invalid, we should remove it
      if (error.statusCode === 410) {
        // Remove the subscription
        const index = subscriptions.indexOf(subscription);
        if (index !== -1) {
          subscriptions.splice(index, 1);
        }
      }
    });
  });
  
  // Execute all push notification promises
  Promise.all(sendPromises)
    .then(() => {
      // Update the subscriptions file after removing invalid ones
      fs.writeFileSync(
        path.join(__dirname, 'subscriptions.json'),
        JSON.stringify(subscriptions, null, 2)
      );
      
      res.status(200).json({ 
        message: `Notifications sent to ${subscriptions.length} subscribers` 
      });
    })
    .catch(error => {
      console.error('Error sending notifications:', error);
      res.status(500).json({ message: 'Error sending notifications' });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
