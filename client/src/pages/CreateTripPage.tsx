import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import axios from 'axios';

export const CreateTripPage: React.FC = () => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { createTrip } = useTripStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const trip = await createTrip(name, startDate || undefined, endDate || undefined);
      navigate(`/trip/${trip.id}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'שגיאה ביצירת הטיול');
      } else {
        setError('שגיאה ביצירת הטיול');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell showBottomNav maxWidth="sm">
      <button
        onClick={() => navigate('/')}
        className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4"
      >
        ← חזרה
      </button>

      <Card className="p-6">
        <h1 className="text-xl font-bold text-neutral-900 mb-5">יצירת טיול חדש</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="שם הטיול"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: אירופה קיץ 2025"
            required
          />
          <Input
            label="תאריך התחלה (אופציונלי)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="תאריך סיום (אופציונלי)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            יצירת טיול ✈️
          </Button>
        </form>
      </Card>
    </AppShell>
  );
};
