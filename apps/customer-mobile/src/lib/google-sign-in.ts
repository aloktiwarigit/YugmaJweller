import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID =
  '528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com';

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

export type GoogleSignInError =
  | 'play_services_unavailable'
  | 'sign_in_cancelled'
  | 'in_progress'
  | 'unknown';

export interface GoogleSignInResult {
  ok: true;
}

export interface GoogleSignInFailure {
  ok:    false;
  error: GoogleSignInError;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult | GoogleSignInFailure> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { data } = await GoogleSignin.signIn();
    if (!data?.idToken) return { ok: false, error: 'unknown' };
    const credential = auth.GoogleAuthProvider.credential(data.idToken);
    await auth().signInWithCredential(credential);
    // Firebase onAuthStateChanged fires in CustomerAuthProvider — no further action here
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, error: 'sign_in_cancelled' };
    if (code === statusCodes.IN_PROGRESS)       return { ok: false, error: 'in_progress' };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, error: 'play_services_unavailable' };
    }
    return { ok: false, error: 'unknown' };
  }
}
