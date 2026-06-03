import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { getLinks, createLink, updateLink, deleteLink, togglePin, updateStatus, uploadFile } from '../controllers/links.controller';

const router = Router();

const storage = multer.diskStorage({
  destination: '/home/dor/tripo/uploads/links',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/:tripId',              authenticateToken, getLinks);
router.post('/:tripId',             authenticateToken, createLink);
router.post('/:tripId/upload',      authenticateToken, upload.single('file'), uploadFile);
router.put('/:linkId',              authenticateToken, updateLink);
router.delete('/:linkId',           authenticateToken, deleteLink);
router.patch('/:linkId/pin',        authenticateToken, togglePin);
router.patch('/:linkId/status',     authenticateToken, updateStatus);

export default router;
