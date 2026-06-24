import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useTripStore } from './store/tripStore';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateTripPage } from './pages/CreateTripPage';
import { TripPage } from './pages/TripPage';
import { JoinPage } from './pages/JoinPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ExpenseFormPage } from './pages/ExpenseFormPage';
import { MapPage } from './pages/MapPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { CreateDecisionPage } from './pages/CreateDecisionPage';
import { LinksPage } from './pages/LinksPage';
import { CreateLinkPage } from './pages/CreateLinkPage';
import { EditLinkPage } from './pages/EditLinkPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { PlannerPage } from './pages/PlannerPage';
import { QuestionnairePage } from './pages/QuestionnairePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { loadUser, token } = useAuthStore();
  const { loadTrips, currentTrip, loadTrip } = useTripStore();
  const currentTripIdRef = useRef(currentTrip?.id);
  currentTripIdRef.current = currentTrip?.id;

  useEffect(() => {
    if (token) loadUser();
  }, []);

  // רענון אוטומטי כשהאפליקציה חוזרת לפוקוס
  useEffect(() => {
    if (!token) return;

    const refresh = () => {
      loadTrips();
      if (currentTripIdRef.current) loadTrip(currentTripIdRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    // visibilitychange — Chrome/Android + רוב הדפדפנים
    document.addEventListener('visibilitychange', onVisibility);
    // focus — fallback ל-iOS PWA שלא תמיד מפעיל visibilitychange
    window.addEventListener('focus', refresh);
    // pageshow — כשהדף מגיע מה-bfcache (back/forward navigation)
    window.addEventListener('pageshow', refresh);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [token]);

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
        <Route path="/trip/:id/expenses" element={
          <ProtectedRoute><ExpensesPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/expenses/new" element={
          <ProtectedRoute><ExpenseFormPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/expenses/edit/:expenseId" element={
          <ProtectedRoute><ExpenseFormPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/map" element={
          <ProtectedRoute><MapPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/decisions" element={
          <ProtectedRoute><DecisionsPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/decisions/new" element={
          <ProtectedRoute><CreateDecisionPage /></ProtectedRoute>
        } />

        <Route path="/trip/:id/links" element={
          <ProtectedRoute><LinksPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/links/new" element={
          <ProtectedRoute><CreateLinkPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/links/edit/:linkId" element={
          <ProtectedRoute><EditLinkPage /></ProtectedRoute>
        } />

        <Route path="/trip/:id/planner" element={
          <ProtectedRoute><PlannerPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/questionnaire" element={
          <ProtectedRoute><QuestionnairePage /></ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        } />
        <Route path="/profile/edit" element={
          <ProtectedRoute><EditProfilePage /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
