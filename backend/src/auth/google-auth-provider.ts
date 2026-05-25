import { unauthenticated } from '../http/api-error.js';

export interface GoogleProfile {
  email: string;
  fullName?: string;
  profileImage?: string;
}

export interface GoogleCallbackInput {
  code?: string;
  idToken?: string;
  redirectUri: string;
}

export interface GoogleAuthProvider {
  getProfile(input: GoogleCallbackInput): Promise<GoogleProfile>;
}

interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenInfoResponse {
  email?: string;
  email_verified?: 'true' | 'false' | boolean;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
}

export class HttpGoogleAuthProvider implements GoogleAuthProvider {
  public constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  public async getProfile(input: GoogleCallbackInput): Promise<GoogleProfile> {
    const idToken = input.idToken ?? (await this.exchangeCodeForIdToken(input));

    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfoResponse;

    if (!tokenInfoResponse.ok || tokenInfo.error || !tokenInfo.email) {
      throw unauthenticated(tokenInfo.error_description ?? 'Google identity verification failed');
    }

    if (tokenInfo.email_verified === false || tokenInfo.email_verified === 'false') {
      throw unauthenticated('Google email is not verified');
    }

    return {
      email: tokenInfo.email,
      fullName: tokenInfo.name,
      profileImage: tokenInfo.picture
    };
  }

  private async exchangeCodeForIdToken(input: GoogleCallbackInput): Promise<string> {
    if (!input.code) {
      throw unauthenticated('Google callback requires an authorization code or ID token');
    }

    const body = new URLSearchParams({
      code: input.code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || tokenPayload.error || !tokenPayload.id_token) {
      throw unauthenticated(tokenPayload.error_description ?? 'Google OAuth token exchange failed');
    }

    return tokenPayload.id_token;
  }
}
