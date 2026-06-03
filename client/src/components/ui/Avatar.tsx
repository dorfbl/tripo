import React from 'react';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, avatarUrl, size = 'md', className = '' }) => {
  const sizes = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-12 h-12' };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizes[size]} rounded-full bg-neutral-200 flex items-end justify-center overflow-hidden flex-shrink-0 ${className}`}>
      <svg viewBox="0 0 40 44" className="w-[75%] h-[75%] text-neutral-400" fill="currentColor">
        <circle cx="20" cy="14" r="9" />
        <path d="M2 44c0-9.941 8.059-18 18-18s18 8.059 18 18" />
      </svg>
    </div>
  );
};
