import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-500 text-lg tracking-tight">
          ✈️ TripTogether
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-neutral-600 hidden sm:block">
                שלום, {user.name}
              </span>
              {location.pathname !== '/' && (
                <Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900">
                  הטיולים שלי
                </Link>
              )}
              {['test@test.com', 'dorfbl@gmail.com'].includes(user.email) && (
                <Link
                  to="/admin/questions"
                  className={`text-sm transition-colors ${
                    location.pathname === '/admin/questions'
                      ? 'text-brand-600 font-medium'
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  ⚙️ שאלון
                </Link>
              )}
              <button
                onClick={logout}
                className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                יציאה
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-brand-500 font-medium">
              כניסה
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
