import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useTripStore } from './store/tripStore';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateTripPage } from './pages/CreateTripPage';
import { TripPage } from './pages/TripPage';
import { TripRedirect } from './pages/TripRedirect';
import { HomePage } from './pages/HomePage';
import { TimelinePage } from './pages/TimelinePage';
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
import { NotificationsPage } from './pages/NotificationsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { AdminPlansPage } from './pages/AdminPlansPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

/** Absolute redirect helpers for legacy URLs */
const RedirectTripPath: React.FC<{ to: (id: string) => string }> = ({ to }) => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={to(id)} replace />;
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

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
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

        {/* Trip entry → last used tab */}
        <Route path="/trip/:id" element={
          <ProtectedRoute><TripRedirect /></ProtectedRoute>
        } />

        {/* בית */}
        <Route path="/trip/:id/home" element={
          <ProtectedRoute><HomePage /></ProtectedRoute>
        } />

        {/* טיול hub */}
        <Route path="/trip/:id/hub" element={
          <ProtectedRoute><TripPage /></ProtectedRoute>
        } />

        {/* ציר זמן */}
        <Route path="/trip/:id/timeline" element={
          <ProtectedRoute><TimelinePage /></ProtectedRoute>
        } />

        {/* תכנון — sub-tabs */}
        <Route path="/trip/:id/plan" element={
          <ProtectedRoute><RedirectTripPath to={(id) => `/trip/${id}/plan/decisions`} /></ProtectedRoute>
        } />
        <Route path="/trip/:id/plan/decisions" element={
          <ProtectedRoute><DecisionsPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/plan/activities" element={
          <ProtectedRoute><QuestionnairePage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/plan/schedule" element={
          <ProtectedRoute><PlannerPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/plan/decisions/new" element={
          <ProtectedRoute><CreateDecisionPage /></ProtectedRoute>
        } />

        {/* כסף */}
        <Route path="/trip/:id/expenses" element={
          <ProtectedRoute><ExpensesPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/expenses/new" element={
          <ProtectedRoute><ExpenseFormPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/expenses/edit/:expenseId" element={
          <ProtectedRoute><ExpenseFormPage /></ProtectedRoute>
        } />

        {/* מפה */}
        <Route path="/trip/:id/map" element={
          <ProtectedRoute><MapPage /></ProtectedRoute>
        } />

        {/* קישורים (under טיול) */}
        <Route path="/trip/:id/links" element={
          <ProtectedRoute><LinksPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/links/new" element={
          <ProtectedRoute><CreateLinkPage /></ProtectedRoute>
        } />
        <Route path="/trip/:id/links/edit/:linkId" element={
          <ProtectedRoute><EditLinkPage /></ProtectedRoute>
        } />

        {/* Legacy redirects — keep old bookmarks working */}
        <Route path="/trip/:id/decisions" element={
          <ProtectedRoute><RedirectTripPath to={(id) => `/trip/${id}/plan/decisions`} /></ProtectedRoute>
        } />
        <Route path="/trip/:id/decisions/new" element={
          <ProtectedRoute><RedirectTripPath to={(id) => `/trip/${id}/plan/decisions/new`} /></ProtectedRoute>
        } />
        <Route path="/trip/:id/planner" element={
          <ProtectedRoute><RedirectTripPath to={(id) => `/trip/${id}/plan/schedule`} /></ProtectedRoute>
        } />
        <Route path="/trip/:id/questionnaire" element={
          <ProtectedRoute><RedirectTripPath to={(id) => `/trip/${id}/plan/activities`} /></ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute><NotificationsPage /></ProtectedRoute>
        } />
        <Route path="/subscription" element={
          <ProtectedRoute><SubscriptionPage /></ProtectedRoute>
        } />
        <Route path="/admin/plans" element={
          <ProtectedRoute><AdminPlansPage /></ProtectedRoute>
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
