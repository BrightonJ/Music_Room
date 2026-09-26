if (typeof window !== 'undefined') {
  const isBenignAudioAbort = (message) =>
    typeof message === 'string' && message.includes('aborted by the user agent');

  window.addEventListener('error', (event) => {
    if (isBenignAudioAbort(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignAudioAbort(event.reason && event.reason.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

import 'expo-router/entry';