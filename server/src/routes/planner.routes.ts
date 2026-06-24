import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import {
  getPlanner, createActivity, bulkCreateActivities, updateActivity, deleteActivity,
  uploadActivityFile, deleteActivityFile,
  createEvent, updateEvent, deleteEvent,
  uploadEventFile, deleteEventFile,
  getMyVotes, getVotes, submitVotes,
} from '../controllers/planner.controller';

const router = Router();
router.use(authenticateToken);

const storage = multer.diskStorage({
  destination: '/home/dor/tripo/uploads/planner',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/:tripId',                                          getPlanner);
router.post('/:tripId/activities/bulk',                         bulkCreateActivities);
router.post('/:tripId/activities',                              createActivity);
router.put('/:tripId/activities/:actId',                        updateActivity);
router.delete('/:tripId/activities/:actId',                     deleteActivity);
router.post('/:tripId/activities/:actId/files', upload.single('file'), uploadActivityFile);
router.delete('/:tripId/activities/:actId/files/:fileId',       deleteActivityFile);
router.post('/:tripId/events',                                              createEvent);
router.patch('/:tripId/events/:eventId',                                    updateEvent);
router.delete('/:tripId/events/:eventId',                                   deleteEvent);
router.post('/:tripId/events/:eventId/files', upload.single('file'),        uploadEventFile);
router.delete('/:tripId/events/:eventId/files/:fileId',                     deleteEventFile);
router.get('/:tripId/votes/mine',                                           getMyVotes);
router.get('/:tripId/votes',                                                getVotes);
router.post('/:tripId/votes',                                               submitVotes);

export default router;
