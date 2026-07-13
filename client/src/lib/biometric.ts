// Web Authentication API utilities for biometric login

export interface BiometricCredential {
  id: string;
  publicKey: string;
}

/**
 * בדיקה אם הדפדפן תומך ב-WebAuthn
 */
export const isBiometricAvailable = (): boolean => {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create
  );
};

/**
 * בדיקה אם יש credentials שמורים למכשיר הנוכחי
 */
export const hasSavedBiometric = (): boolean => {
  return localStorage.getItem('biometric_credential_id') !== null;
};

/**
 * המרת ArrayBuffer ל-Base64
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * המרת Base64 ל-ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * רישום credential ביומטרי חדש
 */
export const registerBiometric = async (
  userId: string,
  email: string
): Promise<BiometricCredential> => {
  if (!isBiometricAvailable()) {
    throw new Error('הדפדפן לא תומך בהתחברות ביומטרית');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Tripo',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential;

  if (!credential) {
    throw new Error('נכשל ביצירת credential ביומטרי');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialId = arrayBufferToBase64(credential.rawId);
  const publicKey = arrayBufferToBase64(response.getPublicKey()!);

  // שמירה ב-localStorage
  localStorage.setItem('biometric_credential_id', credentialId);
  localStorage.setItem('biometric_user_id', userId);

  return {
    id: credentialId,
    publicKey,
  };
};

/**
 * התחברות באמצעות ביומטריה
 */
export const authenticateWithBiometric = async (): Promise<{
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
}> => {
  if (!isBiometricAvailable()) {
    throw new Error('הדפדפן לא תומך בהתחברות ביומטרית');
  }

  const credentialId = localStorage.getItem('biometric_credential_id');
  if (!credentialId) {
    throw new Error('לא נמצא credential ביומטרי שמור');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64ToArrayBuffer(credentialId),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('אימות ביומטרי נכשל');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  return {
    credentialId,
    signature: arrayBufferToBase64(response.signature),
    authenticatorData: arrayBufferToBase64(response.authenticatorData),
    clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
  };
};

/**
 * מחיקת credential ביומטרי שמור
 */
export const clearBiometric = (): void => {
  localStorage.removeItem('biometric_credential_id');
  localStorage.removeItem('biometric_user_id');
};

/**
 * קבלת email של המשתמש עם ביומטריה שמורה
 */
export const getSavedBiometricUserId = (): string | null => {
  return localStorage.getItem('biometric_user_id');
};
