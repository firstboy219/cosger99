import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useFreemium } from '../services/freemiumStore';

export default function GracePeriodBanner() {
  const { subscriptionStatus, inGracePeriod } = useFreemium();

  if (!inGracePeriod) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-xs font-semibold shadow-sm flex-wrap">
      <AlertTriangle size={14} className="flex-shrink-0" />
      <span>
        Masa aktif paket Anda telah habis. Anda dalam masa tenggang
        {subscriptionStatus.daysLeftGrace > 0 && (
          <span className="font-black mx-1">({subscriptionStatus.daysLeftGrace} hari tersisa)</span>
        )}.
        Fitur premium akan terkunci setelah masa tenggang berakhir.
      </span>
      <Link
        to="/app/upgrade"
        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-amber-600 rounded-full font-bold hover:bg-amber-50 transition-colors flex-shrink-0"
      >
        Perpanjang
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
