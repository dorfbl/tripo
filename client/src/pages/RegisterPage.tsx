import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import axios from 'axios';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'שגיאה בהרשמה');
      } else {
        setError('שגיאה בהרשמה');
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✈️</div>
          <h1 className="text-2xl font-bold text-neutral-900">Tripo</h1>
          <p className="text-neutral-600 mt-1 text-sm">צור חשבון חדש</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-5 text-neutral-900">הרשמה</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="שם מלא"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="השם שלך"
              required
            />
            <Input
              label="אימייל"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="סיסמה"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              required
              minLength={6}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={isLoading} className="w-full mt-1">
              יצירת חשבון
            </Button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-4">
            כבר יש לך חשבון?{' '}
            <Link to="/login" className="text-brand-500 font-medium hover:underline">
              כנס כאן
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};
