
import { getConfig } from './mockDb';

let socket: WebSocket | null = null;
let keepAliveInterval: any = null;
let reconnectTimeout: any = null;
let currentUserId: string | null = null;

// Debounce timer for Realtime Sync mode (Protocol 3, Rule 2)
let realtimeDebounceTimer: any = null;
const REALTIME_DEBOUNCE_MS = 2000; // Min 2 seconds between fetches

type MessageHandler = (data: any) => void;
const handlers: Set<MessageHandler> = new Set();

/**
 * V50.18 Protocol 3: Get sync mode from config
 * Returns 'realtime' or 'local-first'
 */
const getSyncMode = (): 'realtime' | 'local-first' => {
    try {
        const config = getConfig();
        const strategy = config.advancedConfig?.syncStrategy || 'background';
        return strategy === 'realtime' ? 'realtime' : 'local-first';
    } catch {
        return 'local-first';
    }
};

/**
 * CONNECT (V50.18 Compliant)
 * - Backend requires userId in query param to whitelist the connection.
 * - Anonymous connections are rejected.
 * - Forces WSS if window is HTTPS.
 */
export const connectWebSocket = (userId: string) => {
    if (socket?.readyState === WebSocket.OPEN) return;
    if (!userId) {
        console.warn("[WS] Connection aborted: No User ID");
        return;
    }

    currentUserId = userId;

    const config = getConfig();
    let backendUrl = config.backendUrl;
    
    if (!backendUrl) {
        return;
    }
    
    backendUrl = backendUrl.replace(/\/$/, '');

    const isSecure = window.location.protocol === 'https:' || backendUrl.startsWith('https:');
    const protocol = isSecure ? 'wss:' : 'ws:';
    let host = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${host}/ws?userId=${userId}`;

    try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('[WS] V50.18 Handshake Success');
            startKeepAlive();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // V50.18 Protocol 3 - EVENT FILTERING (Rule 1):
                // Ignore events that belong to a different user (prevent Ghost Updates)
                if (data.userId && data.userId !== currentUserId) {
                    return; // Silently discard - not our data
                }
                
                // PONG responses from server heartbeat - just acknowledge
                if (data.type === 'PONG' || data.type === 'pong') {
                    return;
                }

                // V50.35 TAHAP 2: WebSocket Force Actions
                // FORCE_LOGOUT: Server-side session revocation
                if (data.type === 'FORCE_LOGOUT' && data.userId === currentUserId) {
                    console.warn('[WS] FORCE_LOGOUT received - cleaning up session');
                    // Clear local auth data
                    localStorage.removeItem('paydone_session_token');
                    localStorage.removeItem('paydone_active_user');
                    localStorage.removeItem('paydone_user_role');
                    // Dispatch logout event
                    window.dispatchEvent(new CustomEvent('PAYDONE_FORCE_LOGOUT', { detail: data }));
                    // Redirect to login immediately
                    setTimeout(() => {
                        window.location.href = '/#/login';
                    }, 100);
                    return;
                }

                // V50.35 TAHAP 2: FORCE_SYNC - Backend requests fresh sync
                if (data.type === 'FORCE_SYNC' && data.userId === currentUserId) {
                    console.log('[WS] FORCE_SYNC received - triggering background pull');
                    // Dispatch custom event for App to catch and trigger sync
                    window.dispatchEvent(new CustomEvent('PAYDONE_FORCE_SYNC', { 
                        detail: { table: data.table, reason: data.reason } 
                    }));
                    return;
                }

                // V50.35 TAHAP 5: Real-time Notifications
                if (data.type === 'NOTIFICATION' && (data.userId === currentUserId || !data.userId)) {
                    console.log('[WS] Notification received:', data.title);
                    // Dispatch event for UI to listen to and update notifications
                    window.dispatchEvent(new CustomEvent('PAYDONE_NOTIFICATION', { detail: data }));
                    return;
                }
                
                // V50.18 Protocol 3 - SYNC MODE AWARENESS (Rule 2):
                const syncMode = getSyncMode();
                
                if (data.type === 'CRUD_UPDATE' || data.type === 'BULK_SYNC') {
                    if (syncMode === 'local-first') {
                        // Local-First mode: Mark "need_sync" flag in background
                        // without aggressively re-rendering the UI
                        window.dispatchEvent(new CustomEvent('PAYDONE_NEED_SYNC', {
                            detail: { table: data.table, type: data.type, timestamp: Date.now() }
                        }));
                        return; // Do NOT propagate to UI handlers
                    }
                    
                    if (syncMode === 'realtime') {
                        // Realtime mode: Debounce min 2 seconds to prevent infinite loop
                        if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
                        realtimeDebounceTimer = setTimeout(() => {
                            handlers.forEach(h => h(data));
                        }, REALTIME_DEBOUNCE_MS);
                        return;
                    }
                }

                // For all other message types, broadcast immediately
                handlers.forEach(h => h(data));
            } catch {
                // Ignore non-json heartbeats / malformed messages
            }
        };

        socket.onclose = (event) => {
            console.log('[WS] Disconnected', event.code);
            stopKeepAlive();
            socket = null;
            
            // Auto Reconnect: Do not reconnect on normal closure (logout)
            if (event.code !== 1000) { 
                reconnectTimeout = setTimeout(() => connectWebSocket(userId), 5000);
            }
        };

        socket.onerror = (error) => {
            console.warn('[WS] Error:', error);
        };

    } catch (e) {
        console.error("[WS] Connection Failed", e);
    }
};

export const disconnectWebSocket = () => {
    if (socket) {
        socket.close(1000, "User Logout");
        socket = null;
    }
    currentUserId = null;
    stopKeepAlive();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
};

export const onMessage = (handler: MessageHandler) => {
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
    };
};

/**
 * V50.18 Protocol 3 - HEARTBEAT (Terminator Protocol):
 * Backend kills connections with no activity in 30 seconds.
 * We send PING every 25 seconds to stay alive (safe margin).
 */
const startKeepAlive = () => {
    stopKeepAlive();
    keepAliveInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
        }
    }, 25000); // 25s - safe margin before 30s Terminator
};

const stopKeepAlive = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
};
