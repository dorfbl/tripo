import React, { useState } from 'react';
import type { SuggestedDestination } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';

interface DestinationCardProps {
  destination: SuggestedDestination;
  onVoted?: () => void;
}

export const DestinationCard: React.FC<DestinationCardProps> = ({ destination, onVoted }) => {
  const { user } = useAuthStore();
  const { voteDestination } = useTripStore();
  const [voting, setVoting] = useState(false);
  const [hoverScore, setHoverScore] = useState(0);

  const myVote = destination.votes.find((v) => v.userId === user?.id)?.score ?? 0;
  const avgVote = destination.votes.length > 0
    ? (destination.votes.reduce((s, v) => s + v.score, 0) / destination.votes.length).toFixed(1)
    : null;

  const matchColor = destination.matchScore >= 80 ? 'green' : destination.matchScore >= 60 ? 'yellow' : 'gray';

  const handleVote = async (score: number) => {
    setVoting(true);
    try {
      await voteDestination(destination.id, score);
      onVoted?.();
    } finally {
      setVoting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold text-neutral-900">{destination.name}</h3>
          <p className="text-sm text-neutral-500">{destination.country}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge color={matchColor}>{destination.matchScore}% התאמה</Badge>
          {destination.climate && (
            <span className="text-xs text-neutral-400">{destination.climate}</span>
          )}
        </div>
      </div>

      <p className="text-sm text-neutral-700 leading-relaxed mb-3">{destination.description}</p>

      <div className="bg-brand-50 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-brand-700 mb-1">למה זה מתאים לכם?</p>
        <p className="text-sm text-brand-800">{destination.whyItFits}</p>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-neutral-500 mb-2">דגשים עיקריים</p>
        <ul className="flex flex-col gap-1">
          {(destination.highlights as string[]).map((h, i) => (
            <li key={i} className="text-sm text-neutral-700 flex items-start gap-2">
              <span className="text-brand-400 mt-0.5">•</span>
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 mb-1">
              {myVote > 0 ? `הצבעת: ${'⭐'.repeat(myVote)}` : 'הצבע על היעד'}
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  disabled={voting}
                  onClick={() => handleVote(s)}
                  onMouseEnter={() => setHoverScore(s)}
                  onMouseLeave={() => setHoverScore(0)}
                  className={`text-xl transition-transform hover:scale-110 ${
                    s <= (hoverScore || myVote) ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
          {avgVote && (
            <div className="text-left">
              <p className="text-xs text-neutral-400">ממוצע קבוצה</p>
              <p className="text-lg font-bold text-neutral-900">⭐ {avgVote}</p>
              <p className="text-xs text-neutral-400">{destination.votes.length} הצבעות</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
