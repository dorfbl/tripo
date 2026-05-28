import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { register, login, getMe, updateProfile, uploadAvatar } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// multer — שמירת תמונות פרופיל
const storage = multer.diskStorage({
  destination: '/home/dor/tripo/uploads/avatars',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/profile/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);

export default router;
