import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'שם, אימייל וסיסמה הם שדות חובה' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: '365d',
    });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'אימייל וסיסמה הם שדות חובה' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: '365d',
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'לא נשלחה תמונה' });
      return;
    }

    // מחק תמונה ישנה אם קיימת
    const existing = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { avatarUrl: true },
    });
    if (existing?.avatarUrl) {
      const oldPath = path.join('/home/dor/tripo/uploads', existing.avatarUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהעלאת התמונה' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'שם הוא שדה חובה' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון הפרופיל' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת פרטי המשתמש' });
  }
};
