import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import tripsRoutes from './routes/trips.routes';
import expensesRoutes from './routes/expenses.routes';
import placesRoutes from './routes/places.routes';
import geocodeRoutes from './routes/geocode.routes';
import decisionsRoutes from './routes/decisions.routes';
import linksRoutes from './routes/links.routes';
import plannerRoutes from './routes/planner.routes';
import timelineRoutes from './routes/timeline.routes';
import weatherRoutes from './routes/weather.routes';
import flightsRoutes from './routes/flights.routes';
import assistantRoutes from './routes/assistant.routes';
import notificationsRoutes from './routes/notifications.routes';
import subscriptionRoutes from './routes/subscription.routes';

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
app.use('/api/expenses', expensesRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/decisions', decisionsRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/flights', flightsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'השרת פועל תקין' });
});

app.use(errorHandler);

export default app;
