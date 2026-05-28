import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import tripsRoutes from './routes/trips.routes';
import questionnaireRoutes from './routes/questionnaire.routes';
import destinationsRoutes from './routes/destinations.routes';
import adminRoutes from './routes/admin.routes';
import expensesRoutes from './routes/expenses.routes';

const app = express();

// נדרש כשעובדים מאחורי reverse proxy (nginx)
app.set('trust proxy', 1);

const allowedOrigins = [
  'https://trip.kefar-sava.co.il',
  'http://localhost:5173',  // פיתוח מקומי
  'http://localhost:3018',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/expenses', expensesRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'השרת פועל תקין' });
});

app.use(errorHandler);

export default app;
