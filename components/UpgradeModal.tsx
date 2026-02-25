import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 text-white relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-3 rounded-2xl">
                <ShieldAlert size={28} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">Fitur Terkunci</h3>
                {featureName && (
                  <p className="text-slate-400 text-xs mt-0.5 font-medium">{featureName}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Maaf, fitur ini tidak termasuk di dalam paket yang kamu gunakan saat ini. 
            Silakan upgrade paket Anda untuk menikmati fitur ini.
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition text-sm"
          >
            Nanti Saja
          </button>
          <button
            onClick={() => {
              onClose();
              navigate('/app/upgrade');
            }}
            className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:from-brand-700 hover:to-indigo-700 shadow-lg shadow-brand-900/20 flex items-center justify-center gap-2 transform active:scale-95 transition"
          >
            Upgrade Sekarang <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
