/**
 * V50.35 TAHAP 6: Global Toast Hook
 * 
 * Provides access to the global toast notification system
 * from any component in the app.
 * 
 * Usage:
 * const { showToast } = useAppToast();
 * showToast('success', 'Done!', 'Operation completed successfully');
 */

export const useAppToast = () => {
  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info' | 'loading',
    title: string,
    message?: string,
    duration?: number
  ) => {
    const event = new CustomEvent('APP_TOAST_SHOW', {
      detail: { type, title, message, duration: duration || 5000 },
    });
    window.dispatchEvent(event);
  };

  return { showToast };
};
