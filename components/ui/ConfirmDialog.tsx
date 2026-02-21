
import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle2, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'danger'
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen) {
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle ESC key manually to ensure onCancel is called
  useEffect(() => {
    const dialog = dialogRef.current;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-fade-in rounded-2xl shadow-2xl"
    >
      <div className="bg-white w-full max-w-sm p-6 border border-slate-100 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-full ${
            variant === 'danger' ? 'bg-red-100 text-red-600' : 
            variant === 'warning' ? 'bg-amber-100 text-amber-600' : 
            'bg-blue-100 text-blue-600'
          }`}>
            {variant === 'danger' ? <AlertTriangle size={24} /> : 
             variant === 'warning' ? <AlertTriangle size={24} /> : 
             <HelpCircle size={24} />}
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 mt-auto">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition transform active:scale-95 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 
              variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 
              'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}
