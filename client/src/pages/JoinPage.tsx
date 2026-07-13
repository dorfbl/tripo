import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';
import axios from 'axios';

export const JoinPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      // שמור את ה-invite code ב-session ועבור להתחברות
      sessionStorage.setItem('pendingInvite', inviteCode || '');
      navigate('/login');
      return;
    }
    join();
  }, [token]);

  const join = async () => {
    try {
      const res = await apiClient.post(`/api/trips/join/${inviteCode}`);
      // TripRedirect will send user to last used tab
      navigate(`/trip/${res.data.trip.id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        // כבר חבר — עצור וחפש את הטיול
        navigate('/');
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">✈️</div>
        <p className="text-neutral-600">מצטרף לטיול...</p>
      </div>
    </div>
  );
};
