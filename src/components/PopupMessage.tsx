import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PopupMessageProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

const PopupMessage: React.FC<PopupMessageProps> = ({ 
  message, 
  duration = 5000, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        onClose();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 m-4 max-w-md w-full relative animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="pr-8">
          <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PopupMessage;