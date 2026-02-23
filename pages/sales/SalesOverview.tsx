import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCurrency } from '../../services/financeUtils';
import {
  TrendingUp, Users, Package, Receipt, AlertCircle, Loader2,
  ArrowUpRight, Clock, CheckCircle, XCircle, DollarSign
} from 'lucide-react';

interface OverviewStats {
  totalUsers: number;
  totalPackages: number;
  pendingTransactions: number;
  activeSubscriptions: number;
  totalRevenue: number;
  recentTransactions: any[];
}

export default function SalesOverview() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0, totalPackages: 0, pendingTransactions: 0,
    activeSubscriptions: 0, totalRevenue: 0, recentTransactions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, pkgRes, txRes] = await Promise.allSettled([
          api.get('/sales/users'),
          api.get('/packages'),
          api.get('/sales/transactions'),
        ]);

        const users = usersRes.status === 'fulfilled' ? (usersRes.value.users || usersRes.value || []) : [];
        const pkgs = pkgRes.status === 'fulfilled' ? (pkgRes.value.packages || pkgRes.value || []) : [];
        const txs = txRes.status === 'fulfilled' ? (txRes.value.subscriptions || txRes.value || []) : [];

        const pending = txs.filter((t: any) => t.status === 'verifying').length;
        const active = txs.filter((t: any) => t.status === 'active').length;
        const revenue = txs
          .filter((t: any) => t.status === 'active')
          .reduce((sum: number, t: any) => sum + (Number(t.amount_paid) || 0), 0);

        setStats({
          totalUsers: users.length,
          totalPackages: pkgs.length,
          pendingTransactions: pending,
          activeSubscriptions: active,
          totalRevenue: revenue,
          recentTransactions: txs.slice(0, 5),
        });
      } catch (e) {
        console.warn('[SalesOverview] Failed to load stats', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-100', iconBg: 'bg-blue-100' },
    { label: 'Paket Aktif', value: stats.totalPackages, icon: Package, color: 'bg-emerald-50 text-emerald-600 border-emerald-100', iconBg: 'bg-emerald-100' },
    { label: 'Pending Approval', value: stats.pendingTransactions, icon: Clock, color: 'bg-amber-50 text-amber-600 border-amber-100', iconBg: 'bg-amber-100' },
    { label: 'Subscription Aktif', value: stats.activeSubscriptions, icon: CheckCircle, color: 'bg-green-50 text-green-600 border-green-100', iconBg: 'bg-green-100' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'bg-indigo-50 text-indigo-600 border-indigo-100', iconBg: 'bg-indigo-100', isString: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sales Overview</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Ringkasan performa CRM & subscription.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className={`rounded-2xl border-2 p-5 ${s.color} transition-all hover:shadow-md`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.iconBg}`}>
              <s.icon size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{s.label}</p>
            <p className="text-2xl font-black">{s.isString ? s.value : Number(s.value).toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/sales/transactions" className="group bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-amber-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <Receipt size={24} className="text-amber-500" />
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-amber-500 transition" />
          </div>
          <h3 className="font-black text-slate-900 text-sm">Approval Transaksi</h3>
          <p className="text-xs text-slate-500 mt-1">{stats.pendingTransactions} menunggu verifikasi</p>
        </Link>

        <Link to="/sales/users" className="group bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <Users size={24} className="text-blue-500" />
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-500 transition" />
          </div>
          <h3 className="font-black text-slate-900 text-sm">Kelola User</h3>
          <p className="text-xs text-slate-500 mt-1">{stats.totalUsers} user terdaftar</p>
        </Link>

        <Link to="/sales/promos" className="group bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-emerald-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp size={24} className="text-emerald-500" />
            <ArrowUpRight size={16} className="text-slate-400 group-hover:text-emerald-500 transition" />
          </div>
          <h3 className="font-black text-slate-900 text-sm">Promo & Reactivation</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola promo dan idle users</p>
        </Link>
      </div>

      {/* Recent Transactions */}
      {stats.recentTransactions.length > 0 && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-black text-slate-900 text-sm">Transaksi Terbaru</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentTransactions.map((tx: any, i: number) => (
              <div key={tx.id || i} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    tx.status === 'active' ? 'bg-green-100 text-green-600' :
                    tx.status === 'verifying' ? 'bg-amber-100 text-amber-600' :
                    tx.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {tx.status === 'active' ? <CheckCircle size={14} /> :
                     tx.status === 'verifying' ? <Clock size={14} /> :
                     tx.status === 'rejected' ? <XCircle size={14} /> :
                     <Receipt size={14} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{tx.package_name || tx.package_id || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{tx.user_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{formatCurrency(tx.amount_paid || 0)}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${
                    tx.status === 'active' ? 'text-green-500' :
                    tx.status === 'verifying' ? 'text-amber-500' :
                    'text-slate-400'
                  }`}>{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
