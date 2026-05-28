import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getActiveUserByEmail, getUserAuthContext } from './auth-context.js';
import { HttpGoogleAuthProvider, type GoogleAuthProvider } from './google-auth-provider.js';
import { unauthenticated } from '../http/api-error.js';

const ALLOWED_EMAIL_DOMAIN = 'mes.ac.in';

interface GoogleCallbackPayload {
  code?: string;
  idToken?: string;
}

interface AuthRoutesOptions {
  googleAuthProvider?: GoogleAuthProvider;
}

interface JwtPayload {
  sub: string;
  email: string;
}

function getClientIp(request: FastifyRequest): string {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() ?? request.ip;
  }

  return request.ip;
}

async function requireJwt(request: FastifyRequest): Promise<JwtPayload> {
  try {
    return await request.jwtVerify<JwtPayload>();
  } catch {
    throw unauthenticated('Valid authentication token is required');
  }
}

function isAllowedEmailDomain(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`) || lower.endsWith(`.${ALLOWED_EMAIL_DOMAIN}`);
}

export async function authRoutes(app: FastifyInstance, options: AuthRoutesOptions = {}): Promise<void> {
  const googleAuthProvider =
    options.googleAuthProvider ??
    new HttpGoogleAuthProvider(app.config.GOOGLE_CLIENT_ID, app.config.GOOGLE_CLIENT_SECRET);

  // Google OAuth login initiation — redirects browser to Google consent screen
  app.get('/api/v1/admin/auth/google/login', async (_request, reply) => {
    const params = new URLSearchParams({
      client_id: app.config.GOOGLE_CLIENT_ID,
      redirect_uri: app.config.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });

    const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return reply.redirect(googleOAuthUrl);
  });

  const handleGoogleCallback = async (request: FastifyRequest<{ Body: GoogleCallbackPayload; Querystring: GoogleCallbackPayload }>, reply: FastifyReply) => {
    const frontendLoginUrl = app.config.NODE_ENV === 'production'
      ? '/login'
      : 'http://localhost:4200/login';

    try {
      const code = request.body?.code ?? request.query?.code;
      const idToken = request.body?.idToken ?? request.query?.idToken;
      const profile = await googleAuthProvider.getProfile({
        code,
        idToken,
        redirectUri: app.config.GOOGLE_CALLBACK_URL
      });

      // Validate email domain
      if (!isAllowedEmailDomain(profile.email)) {
        const errorMsg = encodeURIComponent(`Access denied. Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed.`);
        return reply.redirect(`${frontendLoginUrl}?auth_error=${errorMsg}`);
      }

      const user = await getActiveUserByEmail(app.db, profile.email);

      if (!user) {
        const errorMsg = encodeURIComponent('User is not authorized for this CMS. Contact your administrator.');
        return reply.redirect(`${frontendLoginUrl}?auth_error=${errorMsg}`);
      }

      await app.db('users').where({ id: user.id }).update({
        last_login_at: app.db.fn.now(),
        updated_at: app.db.fn.now(),
        updated_by: user.id
      });

      await app.db('user_login_logs').insert({
        user_id: user.id,
        ip_address: getClientIp(request),
        user_agent: request.headers['user-agent'] ?? null
      });

      const context = await getUserAuthContext(app.db, user.id);
      const token = app.jwt.sign({
        sub: user.id,
        email: user.email
      });

      // Redirect back to frontend with token
      return reply.redirect(`${frontendLoginUrl}?token=${encodeURIComponent(token)}`);
    } catch (error: any) {
      const errorMsg = encodeURIComponent(error.message ?? 'Authentication failed. Please try again.');
      return reply.redirect(`${frontendLoginUrl}?auth_error=${errorMsg}`);
    }
  };

  app.get('/api/v1/admin/auth/google/callback', handleGoogleCallback);
  app.post('/api/v1/admin/auth/google/callback', handleGoogleCallback);

  app.get('/api/v1/admin/auth/me', async (request) => {
    const payload = await requireJwt(request);
    return getUserAuthContext(app.db, payload.sub);
  });

  app.post<{ Body: { email?: string } }>('/api/v1/admin/auth/dev-token', async (request) => {
    if (app.config.NODE_ENV === 'production') {
      throw unauthenticated('Development token login is not available in production');
    }

    const email = request.body?.email;
    if (!email) {
      throw unauthenticated('Email is required for local development token login');
    }

    const user = await getActiveUserByEmail(app.db, email);
    if (!user) {
      throw unauthenticated('User is not authorized for this CMS');
    }

    await app.db('users').where({ id: user.id }).update({
      last_login_at: app.db.fn.now(),
      updated_at: app.db.fn.now(),
      updated_by: user.id
    });

    await app.db('user_login_logs').insert({
      user_id: user.id,
      ip_address: getClientIp(request),
      user_agent: request.headers['user-agent'] ?? null
    });

    const context = await getUserAuthContext(app.db, user.id);
    const token = app.jwt.sign({
      sub: user.id,
      email: user.email
    });

    return {
      token,
      ...context
    };
  });
}
