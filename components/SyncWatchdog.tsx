
import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X, Send, WifiOff } from 'lucide-react';
import { getHeaders } from '../services/cloudSync';
import { getConfig } from '../services/mockDb';

interface UnsyncedItem {
    url: string;
    method: string;
    body: any;
    timestamp: string;
    error: string;
}

export default function SyncWatchdog() {
    const [unsyncedItems, setUnsyncedItems] = useState<UnsyncedItem[]>([]);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isReported, setIsReported] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const loadUnsynced = () => {
        try {
            const raw = localStorage.getItem('unsynced_transactions');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setUnsyncedItems(parsed);
                }
            }
        } catch (e) {
            console.error("Watchdog Storage Error", e);
        }
    };

    useEffect(() => {
        loadUnsynced();
        const handler = () => loadUnsynced();
        window.addEventListener('PAYDONE_SYNC_FAILURE', handler);
        return () => window.removeEventListener('PAYDONE_SYNC_FAILURE', handler);
    }, []);

    const handleRetry = async () => {
        setIsRetrying(true);
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';
        const remaining: UnsyncedItem[] = [];
        let successCount = 0;

        for (const item of unsyncedItems) {
            try {
                const res = await fetch(item.url, {
                    method: item.method,
                    headers: getHeaders(adminId),
                    body: item.method !== 'DELETE' ? JSON.stringify(item.body) : undefined
                });

                if (res.ok) {
                    successCount++;
                } else {
                    remaining.push(item);
                }
            } catch (e) {
                remaining.push(item);
            }
        }

        if (remaining.length === 0) {
            localStorage.removeItem('unsynced_transactions');
            setUnsyncedItems([]);
            alert("✅ All changes synced successfully!");
        } else {
            localStorage.setItem('unsynced_transactions', JSON.stringify(remaining));
            setUnsyncedItems(remaining);
            if (successCount > 0) alert(`⚠️ Synced ${successCount} items, but ${remaining.length} failed again.`);
            
            // Auto Report if retry fails
            handleReport(remaining);
        }
        setIsRetrying(false);
    };

    const handleReport = async (items: UnsyncedItem[]) => {
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        if (!baseUrl) return;

        try {
            await fetch(`${baseUrl}/api/tickets`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    title: `Sync Watchdog Alert: ${items.length} Failed Txn`,
                    description: `Automatic Report.\nFailures:\n${items.map(i => `- ${i.method} ${i.url} (${i.error})`).join('\n')}\n\nPayloads are stored in user localStorage.`,
                    priority: 'high',
                    status: 'open',
                    source: 'watchdog'
                })
            });
            setIsReported(true);
        } catch (e) {
            console.error("Failed to report watchdog issue", e);
        }
    };

    if (unsyncedItems.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[200] animate-bounce-in">
            {showDetails ? (
                <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-500 w-80 overflow-hidden">
                    <div className="p-4 bg-red-600 text-white flex justify-between items-center">
                        <h4 className="font-bold flex items-center gap-2"><WifiOff size={18}/> Sync Failure</h4>
                        <button onClick={() => setShowDetails(false)} className="hover:bg-red-700 p-1 rounded"><X size={16}/></button>
                    </div>
                    <div className="p-4 bg-red-50">
                        <p className="text-xs text-red-800 font-medium mb-3">
                            {unsyncedItems.length} changes are saved locally but failed to reach the cloud.
                        </p>
                        
                        <div className="max-h-32 overflow-y-auto custom-scrollbar bg-white border border-red-200 rounded p-2 mb-3">
                            {unsyncedItems.map((item, idx) => (
                                <div key={idx} className="text-[10px] border-b border-slate-100 last:border-0 pb-1 mb-1">
                                    <span className="font-bold text-slate-700">{item.method}</span> <span className="text-slate-500 truncate">{item.url}</span>
                                    <div className="text-red-500">{item.error}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={handleRetry} 
                                disabled={isRetrying}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 flex items-center justify-center gap-2"
                            >
                                {isRetrying ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                                Retry Sync
                            </button>
                            {isReported ? (
                                <button disabled className="px-3 py-2 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold">Reported</button>
                            ) : (
                                <button onClick={() => handleReport(unsyncedItems)} className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50">
                                    <Send size={14}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <button 
                    onClick={() => setShowDetails(true)}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-red-700 transition transform hover:scale-105"
                >
                    <AlertTriangle size={20} className="animate-pulse"/>
                    <span className="font-bold text-sm">{unsyncedItems.length} Unsaved</span>
                </button>
            )}
        </div>
    );
}
