import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Zap, ArrowRight } from 'lucide-react';
import { useFreemium } from '../services/freemiumStore';

interface FeatureGateProps {
  featureKey: string;
  fallback?: 'hide' | 'lock';
  children: React.ReactNode;
  title?: string;
}

/**
 * FeatureGate wraps premium sections.
 * - If activeFeatures[featureKey] === true (or key is missing), render children normally.
 * - If false + fallback='hide', render nothing.
 * - If false + fallback='lock', render a lock overlay with upgrade CTA.
 */
export default function FeatureGate({ featureKey, fallback = 'lock', children, title }: FeatureGateProps) {
  const { isFeatureAvailable } = useFreemium();

  if (isFeatureAvailable(featureKey)) {
    return <>{children}</>;
  }

  if (fallback === 'hide') return null;

  // Lock overlay
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Blurred background hint */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-40 scale-[0.98]">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="flex flex-col items-center text-center px-6 max-w-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Lock size={24} className="text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-slate-700 mb-1">
            {title || 'Fitur Premium'}
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            Upgrade ke paket Premium untuk mengakses fitur ini dan dapatkan kemampuan penuh.
          </p>
          <Link
            to="/app/upgrade"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-full shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.03] active:scale-[0.97]"
          >
            <Zap size={14} />
            Upgrade Premium
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
