import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { env } from './env.js';
import { query } from './database.js';
import { logger } from '../utils/logger.js';

/**
 * Busca un usuario por oauth provider+id o lo crea si no existe.
 * Retorna el objeto user de la BD.
 */
async function findOrCreateUser(profile, provider, tokens) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('El proveedor OAuth no retornó email');

  // 1. ¿El proveedor ya existe?
  const existingOAuth = await query(
    'SELECT u.* FROM users u JOIN oauth_accounts o ON o.user_id = u.id WHERE o.provider = $1 AND o.provider_id = $2',
    [provider, profile.id]
  );
  if (existingOAuth.rows.length > 0) {
    // Actualiza tokens
    await query(
      'UPDATE oauth_accounts SET access_token=$1, refresh_token=$2, token_expiry=$3 WHERE provider=$4 AND provider_id=$5',
      [tokens.accessToken, tokens.refreshToken, tokens.tokenExpiry || null, provider, profile.id]
    );
    return existingOAuth.rows[0];
  }

  // 2. ¿El email ya existe sin este proveedor?
  let user;
  const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);

  if (existingUser.rows.length > 0) {
    user = existingUser.rows[0];
  } else {
    // 3. Crear usuario nuevo
    const newUser = await query(
      `INSERT INTO users (email, full_name, avatar_url, role)
       VALUES ($1, $2, $3, 'agent')
       RETURNING *`,
      [
        email,
        profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName,
        profile.photos?.[0]?.value || null,
      ]
    );
    user = newUser.rows[0];
    logger.info('Nuevo usuario creado via OAuth', { userId: user.id, email, provider });
  }

  // 4. Vincula la cuenta OAuth
  await query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_id, access_token, refresh_token)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider, provider_id) DO UPDATE SET access_token=$4, refresh_token=$5`,
    [user.id, provider, profile.id, tokens.accessToken, tokens.refreshToken || null]
  );

  return user;
}

export function initializePassport() {
  // Google OAuth
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${env.API_BASE_URL}/api/v1/auth/google/callback`,
      scope: ['profile', 'email'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile, 'google', { accessToken, refreshToken });
        done(null, user);
      } catch (err) {
        logger.error('Error en Google OAuth', { error: err.message });
        done(err);
      }
    }));
  }

  // Microsoft OAuth
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
      clientID: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      callbackURL: `${env.API_BASE_URL}/api/v1/auth/microsoft/callback`,
      tenant: env.MICROSOFT_TENANT_ID,
      scope: ['user.read'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile, 'microsoft', { accessToken, refreshToken });
        done(null, user);
      } catch (err) {
        logger.error('Error en Microsoft OAuth', { error: err.message });
        done(err);
      }
    }));
  }

  // Serialización mínima (no usamos sessions, solo passport para OAuth flow)
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || false);
    } catch (err) {
      done(err);
    }
  });
}
