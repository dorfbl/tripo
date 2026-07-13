import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import axios from 'axios';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);
  const { login, loginWithBiometric, isLoading, isBiometricAvailable, hasSavedBiometric } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // בדיקה אם יש אפשרות להתחברות ביומטרית
    setShowBiometric(isBiometricAvailable() && hasSavedBiometric());
  }, [isBiometricAvailable, hasSavedBiometric]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'שגיאה בהתחברות');
      } else {
        setError('שגיאה בהתחברות');
      }
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    try {
      await loginWithBiometric();
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'שגיאה באימות ביומטרי');
      } else {
        setError('שגיאה באימות ביומטרי');
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✈️</div>
          <h1 className="text-2xl font-bold text-neutral-900">Tripo</h1>
          <p className="text-neutral-600 mt-1 text-sm">תכנון טיולים קבוצתיים</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-5 text-neutral-900">כניסה</h2>

          {showBiometric && (
            <div className="mb-4">
              <Button
                onClick={handleBiometricLogin}
                size="lg"
                loading={isLoading}
                className="w-full bg-neutral-900 hover:bg-neutral-800"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="text-xl">🔐</span>
                  התחבר עם {' '}
                  {navigator.userAgent.includes('Mac') ? 'Face ID / Touch ID' : 'ביומטריה'}
                </span>
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-neutral-500">או</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              placeholder="הסיסמה שלך"
              required
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={isLoading} className="w-full mt-1">
              כניסה
            </Button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-4">
            עדיין אין לך חשבון?{' '}
            <Link to="/register" className="text-brand-500 font-medium hover:underline">
              הירשם כאן
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};
