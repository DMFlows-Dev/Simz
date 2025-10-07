require('dotenv').config();
const express = require('express');

const callRoutes = require('./routes/callRoutes');

const app = express();
app.use(express.json());
app.use('/api', callRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
