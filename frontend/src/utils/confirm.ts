// src/utils/confirm.ts
// Cross-platform confirm dialog.
// On Web: react-native-web's Alert.alert with multi-button is a no-op,
// so we fallback to window.confirm. On native: use Alert.alert as usual.
import { Alert, Platform } from 'react-native';

export const confirmAsync = (
  title: string,
  message: string,
  options?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
): Promise<boolean> => {
  const { confirmLabel = 'Ya', cancelLabel = 'Batal', destructive = false } = options || {};

  if (Platform.OS === 'web') {
    // window.confirm is synchronous; wrap in Promise for unified API.
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(`${title}\n\n${message}`);
      return Promise.resolve(ok);
    }
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

export const alertAsync = (title: string, message?: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
};
