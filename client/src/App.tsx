import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateTripPage } from './pages/CreateTripPage';
import { TripPage } from './pages/TripPage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { DestinationsPage } from './pages/DestinationsPage';
import { JoinPage } from './pages/JoinPage';
import { AdminQuestionsPage } from './pages/AdminQuestionsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { loadUser, token } = useAuthStore();

  useEffect(() => {
    if (token) loadUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join/:inviteCode" element={<JoinPage />} />

        <Route path="/" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        } />
        <Route path="/create-trip" element={
          <ProtectedRoute><CreateTripPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id" element={
          <ProtectedRoute><TripPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/questionnaire" element={
          <ProtectedRoute><QuestionnairePage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/destinations" element={
          <ProtectedRoute><DestinationsPage /></ProtectedRoute>
        } />

        <Route path="/admin/questions" element={
          <ProtectedRoute><AdminQuestionsPage /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
