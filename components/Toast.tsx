import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle, Loader2 } from 'lucide-react';

export interface ToastConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastProps extends ToastConfig {
  onClose: () => void;
}

// V50.35 TAHAP 6: Toast notification with auto-dismiss
const Toast: React.FC<ToastProps> = ({ id, type, title, message, duration = 5000, action, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (type === 'loading' || duration === 0) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, type, onClose]);

  const iconConfig = {
    success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
    loading: { icon: Loader2, color: 'text-slate-600', bg: 'bg-slate-50' },
  };

  const config = iconConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`transform transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      <div className={`flex items-start gap-3 ${config.bg} border border-l-4 rounded-lg p-4 shadow-lg`}>
        {type === 'loading' ? (
          <Icon size={20} className={`${config.color} animate-spin flex-shrink-0 mt-0.5`} />
        ) : (
          <Icon size={20} className={`${config.color} flex-shrink-0 mt-0.5`} />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{title}</p>
          {message && <p className="text-xs text-slate-600 mt-1">{message}</p>}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap ml-2 flex-shrink-0"
          >
            {action.label}
          </button>
        )}

        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Toast Container Context
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const add = (toast: Omit<ToastConfig, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  };

  const remove = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clear = () => {
    setToasts([]);
  };

  return { toasts, add, remove, clear };
};

export default Toast;
