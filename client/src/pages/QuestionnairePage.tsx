import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { ProgressBar } from '../components/questionnaire/ProgressBar';
import { QuestionCard } from '../components/questionnaire/QuestionCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import axios from 'axios';

export const QuestionnairePage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { questions, loadQuestions, saveAnswers } = useTripStore();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-400">טוען שאלות...</p>
      </div>
    );
  }

  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const hasAnswer = answers[current.id] !== undefined &&
    answers[current.id] !== '' &&
    !(Array.isArray(answers[current.id]) && (answers[current.id] as unknown[]).length === 0);

  const goNext = () => {
    if (!isLast) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setAnimating(false);
      }, 150);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setAnimating(false);
      }, 150);
    }
  };

  const handleSubmit = async () => {
    if (!tripId) return;
    setSaving(true);
    setError('');
    try {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      await saveAnswers(tripId, answersArray);
      navigate(`/trip/${tripId}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'שגיאה בשמירת התשובות');
      } else {
        setError('שגיאה בשמירת התשובות');
      }
    } finally {
      setSaving(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const canSubmitEarly = answeredCount >= Math.floor(questions.length * 0.5);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(`/trip/${tripId}`)}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← ביטול
          </button>
          <h1 className="font-semibold text-neutral-900 text-sm">שאלון טיול</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        <ProgressBar current={currentIndex + 1} total={questions.length} />

        <div
          className={`transition-opacity duration-150 ${animating ? 'opacity-0' : 'opacity-100'}`}
        >
          <Card className="p-6 mb-6">
            <div className="mb-1">
              <span className="text-xs text-brand-500 font-medium uppercase tracking-wide">
                {current.category}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-5 leading-relaxed">
              {current.text}
            </h2>
            <QuestionCard
              question={current}
              value={answers[current.id]}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [current.id]: val }))}
            />
          </Card>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-auto">
          <Button
            variant="secondary"
            size="lg"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex-1"
          >
            ← חזרה
          </Button>

          {isLast ? (
            <Button
              size="lg"
              onClick={handleSubmit}
              loading={saving}
              className="flex-1"
            >
              סיום ושמירה ✓
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={goNext}
              disabled={!hasAnswer && current.type !== 'TEXT'}
              className="flex-1"
            >
              הבא →
            </Button>
          )}
        </div>

        {canSubmitEarly && !isLast && (
          <button
            onClick={handleSubmit}
            className="text-center text-xs text-neutral-400 hover:text-neutral-600 mt-3"
          >
            שלח עכשיו ({answeredCount}/{questions.length} שאלות ענית)
          </button>
        )}
      </main>
    </div>
  );
};
