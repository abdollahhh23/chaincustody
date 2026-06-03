import express from 'express';
import cors from 'cors';
import batchRoutes from './routes/batch.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/batches', batchRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ChainCustody secure backend running on port ${PORT}`);
});
