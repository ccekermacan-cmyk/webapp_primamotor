import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Pesan error validasi yang ditampilkan tepat di bawah field terkait. */
export const FieldError: React.FC<{ message?: string; className?: string }> = ({ message, className = '' }) => {
  if (!message) return null;
  return (
    <p role="alert" className={`flex items-start gap-1.5 text-[11px] font-semibold text-rose-600 mt-1.5 ${className}`}>
      <AlertCircle size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
};

export default FieldError;
