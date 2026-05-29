import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { getPlaces, addPlace, updatePlace, deletePlace, addPhoto, deletePhoto } from '../controllers/places.controller';

const router = Router();

const storage = multer.diskStorage({
  destination: '/home/dor/tripo/uploads/places',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — sharp יכווץ
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/:tripId',                   authenticateToken, getPlaces);
router.post('/:tripId',                  authenticateToken, addPlace);
router.put('/:placeId',                  authenticateToken, updatePlace);
router.delete('/:placeId',              authenticateToken, deletePlace);
router.post('/:placeId/photos',          authenticateToken, upload.single('photo'), addPhoto);
router.delete('/photos/:photoId',        authenticateToken, deletePhoto);

export default router;
