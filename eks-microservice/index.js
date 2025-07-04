const express = require('express');
const app = express();
app.use(express.json());

app.post('/process-order', (req, res) => {
  res.json({
    orderId: 'order-' + Date.now(),
    status: 'Processed',
    details: req.body
  });
});

app.listen(3000, () => console.log('Mock EKS service running on port 3000'));