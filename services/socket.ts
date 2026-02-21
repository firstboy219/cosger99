
import { getConfig } from './mockDb';

let socket: WebSocket | null = null;
let keepAliveInterval: any = null;
let reconnectTimeout: any = null;

type MessageHandler = (data: any) => void;
const handlers: Set<MessageHandler> = new Set();

/**
 * CONNECT (SNIPER MODE)
 * Backend V34/V42 requires userId in query param to whitelist the connection.
 * Anonymous connections are rejected.
 * Forces WSS if window is HTTPS.
 */
export const connectWebSocket = (userId: string) => {
    if (socket?.readyState === WebSocket.OPEN) return;
    if (!userId) {
        console.warn("[WS] Connection aborted: No User ID");
        return;
    }

    const config = getConfig();
    let backendUrl = config.backendUrl;
    
    if (!backendUrl) {
        console.debug("[WS] No backend URL configured. WebSocket disabled.");
        return;
    }
    
    // Remove trailing slash
    backendUrl = backendUrl.replace(/\/$/, '');

    // 1. Determine Protocol (Secure WebSocket if on HTTPS)
    const isSecure = window.location.protocol === 'https:' || backendUrl.startsWith('https:');
    const protocol = isSecure ? 'wss:' : 'ws:';

    // 2. Extract Host
    let host = backendUrl.replace(/^https?:\/\//, '');
    
    // 3. Construct V42 Compliant URL
    // Pattern: wss://[HOST]/ws?userId=[USER_ID]
    const wsUrl = `${protocol}//${host}/ws?userId=${userId}`;

    console.log(`[WS] Connecting to V42 Secure Stream: ${wsUrl}`);

    try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('[WS] V42 Handshake Success');
            startKeepAlive();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Broadcast to internal listeners
                handlers.forEach(h => h(data));
            } catch (e) {
                // Ignore non-json heartbeats
            }
        };

        socket.onclose = (event) => {
            console.log('[WS] Disconnected', event.code);
            stopKeepAlive();
            socket = null;
            
            // Auto Reconnect Strategy (Exponential Backoff could be applied here)
            // Do not reconnect if it was a normal closure (e.g. logout)
            if (event.code !== 1000) { 
                reconnectTimeout = setTimeout(() => connectWebSocket(userId), 5000);
            }
        };

        socket.onerror = (error) => {
            console.warn('[WS] Error:', error);
            // Allow onclose to handle cleanup
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
    stopKeepAlive();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
};

export const onMessage = (handler: MessageHandler) => {
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
    };
};

// --- HEARTBEAT ---
const startKeepAlive = () => {
    stopKeepAlive();
    keepAliveInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
        }
    }, 30000); // 30s Ping
};

const stopKeepAlive = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
};
