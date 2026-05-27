import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import tripsRoutes from './routes/trips.routes';
import questionnaireRoutes from './routes/questionnaire.routes';
import destinationsRoutes from './routes/destinations.routes';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/destinations', destinationsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'השרת פועל תקין' });
});

app.use(errorHandler);

export default app;
