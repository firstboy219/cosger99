/**
 * V50.35 TAHAP 2: Radar Telemetry - Anti Silent-Crash System
 * Intercepts global errors and sends crash data to backend silently
 */

import { api } from './api';

interface CrashEvent {
  userId: string;
  errorMessage: string;
  stackTrace?: string;
  route: string;
  browserInfo: {
    userAgent: string;
    language: string;
    platform: string;
    screenResolution: string;
  };
  stateSnapshot: Record<string, any>;
  timestamp: string;
}

interface ClientEvent {
  userId?: string;
  sessionId: string;
  eventType: string;
  eventName: string;
  pageUrl: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Generate or retrieve session ID
const getOrCreateSessionId = (): string => {
  let sessionId = sessionStorage.getItem('telemetry_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('telemetry_session_id', sessionId);
  }
  return sessionId;
};

/**
 * Radar: Listen for unhandled global errors
 * Sends crash data to POST /api/telemetry/crash silently (no UI notification)
 */
// Bug 9: Helper to build a rich crash payload that triggers ticket creation
const buildCrashPayload = (errorMessage: string, stackTrace?: string, extra?: Record<string, any>) => {
  const route = window.location.hash || window.location.pathname;
  // Classify severity: all JS crashes are HIGH to trigger admin ticket creation
  const severity = 'HIGH';
  // Attempt to extract module/menu name from route
  const routeParts = route.replace('#/', '').split('/');
  const menuName = routeParts[0] || 'unknown';
  const moduleName = routeParts.slice(0, 2).join('/') || route;
  return {
    userId: localStorage.getItem('paydone_active_user') || 'anonymous',
    // Rich fields that backend expects for ticket generation
    errorMessage,
    errorType: extra?.errorType || 'UnhandledError',
    stackTrace: stackTrace || 'No stack trace',
    severity,                  // Bug 9: send HIGH so ticket gets created
    routeUrl: route,
    menuName,
    moduleName,
    componentName: extra?.componentName || '',
    actionPerformed: extra?.actionPerformed || '',
    previousRoute: document.referrer || '',
    browserInfo: navigator.userAgent,
    browserName: navigator.userAgent.split(' ').pop() || '',
    operatingSystem: navigator.platform,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    networkOnline: navigator.onLine,
    networkType: (navigator as any).connection?.effectiveType || 'unknown',
    appVersion: 'v50.63',
    sessionDurationSeconds: Math.round((Date.now() - (window._appStartTime || Date.now())) / 1000),
    stateSnapshot: {
      localStorage: {
        hasToken: !!localStorage.getItem('paydone_session_token'),
        userId: localStorage.getItem('paydone_active_user'),
        role: localStorage.getItem('paydone_user_role'),
      },
      timestamp: Date.now(),
      ...extra
    },
    timestamp: new Date().toISOString()
  };
};

// Set app start time for session duration tracking
if (typeof window !== 'undefined') {
  (window as any)._appStartTime = (window as any)._appStartTime || Date.now();
}

export const initializeRadarTelemetry = () => {
  const originalOnError = window.onerror;

  window.onerror = (message: any, source: any, lineno: any, colno: any, error: any) => {
    const payload = buildCrashPayload(
      message?.toString() || 'Unknown Error',
      error?.stack || `${source}:${lineno}:${colno}`,
      { errorType: error?.name || 'Error', componentName: source || '' }
    );

    // Bug 9: Send with full payload so backend creates admin ticket
    api.post('/telemetry/crash', payload).catch(e => {
      console.debug('[Telemetry] Crash report failed:', e);
    });

    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Also listen for unhandled promise rejections
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const payload = buildCrashPayload(
      event.reason?.message || event.reason?.toString() || 'Unhandled Promise Rejection',
      event.reason?.stack,
      { errorType: 'UnhandledPromiseRejection', actionPerformed: 'async_operation' }
    );

    // Bug 9: Send with full payload
    api.post('/telemetry/crash', payload).catch(e => {
      console.debug('[Telemetry] Unhandled rejection report failed:', e);
    });

    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection(event);
    }
  };
};

/**
 * Track client events (page views, clicks, etc.)
 * Can be used for analytics
 */
export const trackClientEvent = async (eventType: string, eventName: string, metadata?: Record<string, any>) => {
  try {
    const sessionId = getOrCreateSessionId();
    const userId = localStorage.getItem('paydone_active_user');

    const event: ClientEvent = {
      userId: userId || undefined,
      sessionId,
      eventType,
      eventName,
      pageUrl: window.location.href,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Send telemetry in background (fire and forget)
    api.post('/telemetry/event', event).catch(e => {
      console.debug('[Telemetry] Event tracking failed:', e);
    });
  } catch (e) {
    // Fail silently
    console.debug('[Telemetry] Error tracking event:', e);
  }
};

/**
 * Track page views
 */
export const trackPageView = (pageName: string, metadata?: Record<string, any>) => {
  trackClientEvent('page_view', pageName, metadata);
};

/**
 * Track button clicks
 */
export const trackButtonClick = (buttonName: string, metadata?: Record<string, any>) => {
  trackClientEvent('button_click', buttonName, metadata);
};

/**
 * Track form submissions
 */
export const trackFormSubmit = (formName: string, metadata?: Record<string, any>) => {
  trackClientEvent('form_submit', formName, metadata);
};
