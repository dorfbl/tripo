import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import apiClient from '../api/client';

export const TripPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentTrip, loadTrip, isLoading, generateDestinations } = useTripStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [questStatus, setQuestStatus] = useState<{
    total: number; completed: number;
    members: { userId: string; name: string; completed: boolean }[];
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadTrip(id);
      loadStatus(id);
    }
  }, [id]);

  const loadStatus = async (tripId: string) => {
    try {
      const res = await apiClient.get(`/api/questionnaire/${tripId}/status`);
      setQuestStatus(res.data);
    } catch { /* ignore */ }
  };

  const copyInvite = () => {
    if (!currentTrip) return;
    const url = `${window.location.origin}/join/${currentTrip.inviteCode}`;
    navigator.clipboard.writeText(url);
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
      const error = err as { response?: { data?: { error?: string } } };
      setGenError(error.response?.data?.error || 'שגיאה בייצור המלצות');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !currentTrip) {
    return (
      <AppShell><div className="text-center py-12 text-neutral-400">טוען...</div></AppShell>
    );
  }

  const myMember = currentTrip.members.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === 'ADMIN';
  const myCompleted = myMember?.completedQuestionnaire ?? false;

  return (
    <AppShell>
      <button
        onClick={() => navigate('/')}
        className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4"
      >
        ← הטיולים שלי
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{currentTrip.name}</h1>
            {currentTrip.startDate && (
              <p className="text-sm text-neutral-400 mt-1">
                {new Date(currentTrip.startDate).toLocaleDateString('he-IL')}
                {currentTrip.endDate && ` — ${new Date(currentTrip.endDate).toLocaleDateString('he-IL')}`}
              </p>
            )}
          </div>
          <Badge color={currentTrip.status === 'PLANNING' ? 'blue' : currentTrip.status === 'VOTING' ? 'yellow' : 'green'}>
            {currentTrip.status === 'PLANNING' ? 'תכנון' : currentTrip.status === 'VOTING' ? 'הצבעות' : currentTrip.status}
          </Badge>
        </div>
      </div>

      {/* הזמנת חברים */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-neutral-800">שתף לינק הצטרפות</h2>
          <Button variant="secondary" size="sm" onClick={copyInvite}>
            {copied ? '✓ הועתק!' : 'העתק לינק'}
          </Button>
        </div>
        <p className="text-xs text-neutral-400 font-mono truncate">
          {window.location.origin}/join/{currentTrip.inviteCode}
        </p>
      </Card>

      {/* חברי הטיול + סטטוס שאלון */}
      <Card className="p-4 mb-4">
        <h2 className="font-semibold text-neutral-800 mb-3">
          חברי הקבוצה
          {questStatus && (
            <span className="text-sm font-normal text-neutral-400 mr-2">
              ({questStatus.completed}/{questStatus.total} מילאו שאלון)
            </span>
          )}
        </h2>
        <div className="flex flex-col gap-2">
          {currentTrip.members.map((member) => {
            const statusMember = questStatus?.members.find((m) => m.userId === member.userId);
            return (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={member.user.name} size="sm" />
                  <div>
                    <span className="text-sm font-medium text-neutral-800">{member.user.name}</span>
                    {member.role === 'ADMIN' && (
                      <span className="text-xs text-neutral-400 mr-1">👑</span>
                    )}
                  </div>
                </div>
                {statusMember?.completed ? (
                  <span className="text-xs text-green-600 font-medium">✅ מילא</span>
                ) : (
                  <span className="text-xs text-neutral-400">ממתין...</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* פעולות */}
      {currentTrip.status === 'PLANNING' && (
        <div className="flex flex-col gap-3">
          {!myCompleted && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate(`/trip/${id}/questionnaire`)}
            >
              📋 מלא את השאלון
            </Button>
          )}

          {myCompleted && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">
              ✅ מילאת את השאלון! ממתין לשאר החברים...
            </div>
          )}

          {isAdmin && questStatus && questStatus.completed > 0 && (
            <div>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                loading={generating}
                onClick={handleGenerate}
              >
                🤖 קבל המלצות מ-AI
                {questStatus.completed < questStatus.total && (
                  <span className="text-xs mr-1 opacity-70">({questStatus.total - questStatus.completed} עדיין לא מילאו)</span>
                )}
              </Button>
              {genError && <p className="text-xs text-red-500 mt-1 text-center">{genError}</p>}
            </div>
          )}
        </div>
      )}

      {currentTrip.status === 'VOTING' && (
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate(`/trip/${id}/destinations`)}
        >
          🗳️ לצפות ביעדים ולהצביע
        </Button>
      )}
    </AppShell>
  );
};
