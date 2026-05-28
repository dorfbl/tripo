import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { useActiveTripStore } from '../store/activeTripStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import apiClient from '../api/client';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'תכנון',
  VOTING: 'הצבעות',
  BOOKED: 'נקבע',
  ONGOING: 'בדרך!',
  COMPLETED: 'הושלם',
};

export const TripPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentTrip, loadTrip, isLoading, generateDestinations } = useTripStore();
  const { user } = useAuthStore();
  const { setActiveTrip } = useActiveTripStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [questStatus, setQuestStatus] = useState<{
    total: number; completed: number;
    members: { userId: string; name: string; completed: boolean }[];
  } | null>(null);

  useEffect(() => {
    if (id) { loadTrip(id); loadStatus(id); }
  }, [id]);

  // עדכן את הטיול הפעיל כשהטיול נטען
  useEffect(() => {
    if (id && currentTrip) {
      setActiveTrip(id, currentTrip.name);
    }
  }, [id, currentTrip?.name]);

  const loadStatus = async (tripId: string) => {
    try {
      const res = await apiClient.get(`/api/questionnaire/${tripId}/status`);
      setQuestStatus(res.data);
    } catch { /* ignore */ }
  };

  const copyInvite = () => {
    if (!currentTrip) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${currentTrip.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!id) return;
    setGenError('');
    setGenerating(true);
    try {
      await generateDestinations(id);
      navigate(`/trip/${id}/destinations`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setGenError(e.response?.data?.error || 'שגיאה בייצור המלצות');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !currentTrip) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      </AppShell>
    );
  }

  const myMember   = currentTrip.members.find((m) => m.userId === user?.id);
  const isAdmin    = myMember?.role === 'ADMIN';
  const myCompleted = myMember?.completedQuestionnaire ?? false;

  return (
    <AppShell showBottomNav>

      {/* ─── כותרת הטיול ─── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-neutral-900 leading-tight">{currentTrip.name}</h1>

        {/* תאריכים */}
        {currentTrip.startDate ? (
          <p className="text-sm text-neutral-500 mt-1">
            📅 {new Date(currentTrip.startDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
            {currentTrip.endDate && (
              <> — {new Date(currentTrip.endDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
          </p>
        ) : (
          <p className="text-sm text-neutral-400 mt-1">📅 תאריכים טרם נקבעו</p>
        )}

        {/* סטטוס */}
        <div className="mt-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            currentTrip.status === 'PLANNING'  ? 'bg-blue-100 text-blue-600' :
            currentTrip.status === 'VOTING'    ? 'bg-yellow-100 text-yellow-700' :
            currentTrip.status === 'ONGOING'   ? 'bg-green-100 text-green-700' :
            'bg-neutral-100 text-neutral-500'
          }`}>
            {STATUS_LABEL[currentTrip.status] ?? currentTrip.status}
          </span>
        </div>
      </div>

      {/* ─── חברי הקבוצה ─── */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-800">
            חברי הקבוצה
            <span className="text-sm font-normal text-neutral-400 mr-1.5">
              ({currentTrip.members.length})
            </span>
          </h2>
          <button
            onClick={copyInvite}
            className="text-xs text-brand-500 font-medium hover:text-brand-700 transition-colors"
          >
            {copied ? '✓ הועתק' : '+ הזמן חבר'}
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {currentTrip.members.map((member) => {
            const statusMember = questStatus?.members.find((m) => m.userId === member.userId);
            return (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.user.name} size="sm" />
                  <span className="text-sm font-medium text-neutral-800">
                    {member.user.name}
                    {member.role === 'ADMIN' && <span className="mr-1 text-xs">👑</span>}
                  </span>
                </div>
                {currentTrip.status === 'PLANNING' && (
                  statusMember?.completed
                    ? <span className="text-xs text-green-600 font-medium">✅ מילא שאלון</span>
                    : <span className="text-xs text-neutral-400">ממתין...</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ─── פעולות לפי שלב ─── */}

      {currentTrip.status === 'PLANNING' && (
        <div className="flex flex-col gap-3">
          {!myCompleted && (
            <Button size="lg" className="w-full" onClick={() => navigate(`/trip/${id}/questionnaire`)}>
              📋 מלא את השאלון
            </Button>
          )}

          {myCompleted && !isAdmin && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">
              ✅ מילאת את השאלון!
              {questStatus && questStatus.completed < questStatus.total
                ? ` ממתין ל-${questStatus.total - questStatus.completed} חברים נוספים...`
                : ' המנהל יייצר את ההמלצות בקרוב.'}
            </div>
          )}

          {isAdmin && questStatus && questStatus.completed > 0 && (
            <div>
              <Button size="lg" className="w-full" loading={generating} onClick={handleGenerate}>
                🤖 ייצר המלצות AI
                {questStatus.completed < questStatus.total && (
                  <span className="text-xs mr-2 opacity-70">
                    ({questStatus.completed}/{questStatus.total} מילאו)
                  </span>
                )}
              </Button>
              {genError && <p className="text-xs text-red-500 mt-1 text-center">{genError}</p>}
            </div>
          )}

          {isAdmin && questStatus && questStatus.completed === 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-500 text-center">
              ממתין שחברים ימלאו את השאלון לפני ייצור המלצות
            </div>
          )}
        </div>
      )}

      {currentTrip.status === 'VOTING' && (
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => navigate(`/trip/${id}/destinations`)}>
            🗳️ לצפות ביעדים ולהצביע
          </Button>
          {isAdmin && (
            <div>
              <Button variant="ghost" size="sm" className="w-full text-neutral-400" loading={generating} onClick={handleGenerate}>
                🔄 ייצר המלצות מחדש
              </Button>
              {genError && <p className="text-xs text-red-500 mt-1 text-center">{genError}</p>}
            </div>
          )}
        </div>
      )}

      {/* ─── אדמין: עריכת שאלות השאלון ─── */}
      {isAdmin && (
        <div className="mt-6 pt-5 border-t border-neutral-100">
          <p className="text-xs text-neutral-400 mb-2 font-medium">כלי מנהל</p>
          <button
            onClick={() => navigate('/admin/questions')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-colors text-sm text-neutral-600"
          >
            <span>⚙️ עריכת שאלות השאלון</span>
            <span className="text-neutral-300">‹</span>
          </button>
        </div>
      )}

    </AppShell>
  );
};
