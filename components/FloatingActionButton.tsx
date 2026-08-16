import { ArrowUp } from 'lucide-react';
import React from 'react';

type Props = {
  onClick?: () => void;
};

const FloatingActionButton: React.FC<Props> = ({ onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      className="floating-action-btn"
      onClick={handleClick}
      aria-label="К поиску"
    >
      <ArrowUp size={24} />
    </button>
  );
};

export default FloatingActionButton;
