import { storeTokens } from '../api/auth';

type OAuthProvider = 'github';

interface OAuthUser {
  id: number;
  email: string;
  username: string;
  role: string;
}

interface OAuthSuccessMessage {
  type: 'oauth-callback';
  accessToken: string;
  refreshToken: string;
  user: OAuthUser;
}

interface OAuthNeedsEmailMessage {
  type: 'oauth-callback';
  needsEmail: true;
  tempToken: string;
}

interface OAuthErrorMessage {
  type: 'oauth-callback';
  error: string;
}

type OAuthMessage = OAuthSuccessMessage | OAuthNeedsEmailMessage | OAuthErrorMessage;

interface OAuthResult {
  accessToken: string;
  refreshToken: string;
  user: OAuthUser;
}

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

function isOAuthSuccessMessage(data: unknown): data is OAuthSuccessMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as OAuthSuccessMessage).type === 'oauth-callback' &&
    'accessToken' in data &&
    'refreshToken' in data &&
    'user' in data
  );
}

function isOAuthNeedsEmailMessage(data: unknown): data is OAuthNeedsEmailMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as OAuthNeedsEmailMessage).type === 'oauth-callback' &&
    (data as OAuthNeedsEmailMessage).needsEmail === true &&
    'tempToken' in data
  );
}

function isOAuthErrorMessage(data: unknown): data is OAuthErrorMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as OAuthErrorMessage).type === 'oauth-callback' &&
    'error' in data
  );
}

export function openOAuthPopup(
  provider: OAuthProvider,
  onEmailRequired?: () => Promise<string>
): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const left = Math.round(window.screen.width / 2 - POPUP_WIDTH / 2);
    const top = Math.round(window.screen.height / 2 - POPUP_HEIGHT / 2);

    const features = [
      `width=${POPUP_WIDTH}`,
      `height=${POPUP_HEIGHT}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'status=no',
      'location=no',
    ].join(',');

    const popup = window.open(`/api/auth/${provider}`, 'oauth-popup', features);

    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Please allow popups for this site and try again.'));
      return;
    }

    function handleMessage(event: MessageEvent) {
      const backendOrigin = 'http://localhost:3001';
      if (event.origin !== window.location.origin && event.origin !== backendOrigin) {
        return;
      }

      const data = event.data;

      if (isOAuthSuccessMessage(data)) {
        storeTokens(data.accessToken, data.refreshToken);
        cleanup();
        resolve({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
      } else if (isOAuthNeedsEmailMessage(data)) {
        cleanup();
        if (onEmailRequired) {
          onEmailRequired()
            .then(async (email) => {
              try {
                const response = await fetch('/api/auth/link-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tempToken: data.tempToken, email }),
                });
                if (!response.ok) {
                  const errText = await response.text();
                  let errMsg: string;
                  try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.error || errText;
                  } catch {
                    errMsg = errText || 'Failed to link email';
                  }
                  reject(new Error(errMsg));
                  return;
                }
                const result = await response.json();
                storeTokens(result.accessToken, result.refreshToken);
                resolve({
                  accessToken: result.accessToken,
                  refreshToken: result.refreshToken,
                  user: result.user,
                });
              } catch (err) {
                reject(err);
              }
            })
            .catch(reject);
        } else {
          reject(new Error('Email is required for this OAuth provider, but no email handler was provided.'));
        }
      } else if (isOAuthErrorMessage(data)) {
        cleanup();
        reject(new Error(data.error));
      }
    }

    const closeCheckInterval = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('OAuth window was closed'));
      }
    }, 500);

    function cleanup() {
      window.removeEventListener('message', handleMessage);
      clearInterval(closeCheckInterval);
    }

    window.addEventListener('message', handleMessage);
  });
}
