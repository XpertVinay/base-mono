const express = require('express');
const app = express();
const port = process.env.PORT || 4141;

app.get('/data', (req, res) => {
  res.json({ message: 'Data retrieved successfully' });
});

app.listen(port, () => {
  console.log(`Data Retrieval Service running on port ${port}`);
});