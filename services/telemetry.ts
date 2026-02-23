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
export const initializeRadarTelemetry = () => {
  const originalOnError = window.onerror;

  window.onerror = (message: any, source: any, lineno: any, colno: any, error: any) => {
    const crashEvent: CrashEvent = {
      userId: localStorage.getItem('paydone_active_user') || 'anonymous',
      errorMessage: message?.toString() || 'Unknown Error',
      stackTrace: error?.stack || `${source}:${lineno}:${colno}`,
      route: window.location.hash || window.location.pathname,
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`
      },
      stateSnapshot: {
        localStorage: {
          hasToken: !!localStorage.getItem('paydone_session_token'),
          userId: localStorage.getItem('paydone_active_user')
        },
        timestamp: Date.now()
      },
      timestamp: new Date().toISOString()
    };

    // Send silently (fire and forget - don't block execution)
    api.post('/telemetry/crash', crashEvent).catch(e => {
      // Fail silently to prevent cascading errors
      console.debug('[Telemetry] Crash report failed:', e);
    });

    // Call original error handler if it exists
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Also listen for unhandled promise rejections
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const crashEvent: CrashEvent = {
      userId: localStorage.getItem('paydone_active_user') || 'anonymous',
      errorMessage: event.reason?.message || event.reason?.toString() || 'Unhandled Promise Rejection',
      stackTrace: event.reason?.stack,
      route: window.location.hash || window.location.pathname,
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`
      },
      stateSnapshot: {
        localStorage: {
          hasToken: !!localStorage.getItem('paydone_session_token'),
          userId: localStorage.getItem('paydone_active_user')
        },
        eventType: 'unhandledRejection'
      },
      timestamp: new Date().toISOString()
    };

    api.post('/telemetry/crash', crashEvent).catch(e => {
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
