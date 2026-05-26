import { env } from '../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api',
};

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: parseMaxAge(env.JWT_EXPIRES_IN),
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  path: '/api/v1/auth',
  maxAge: parseMaxAge(env.JWT_REFRESH_EXPIRES_IN),
};

export function parseMaxAge(expiresIn) {
  const match = expiresIn.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 60000);
}

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
  res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
}

export function getAccessToken(req) {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function getRefreshToken(req) {
  if (req.cookies?.refreshToken) {
    return req.cookies.refreshToken;
  }
  if (req.body?.refreshToken) {
    return req.body.refreshToken;
  }
  return null;
}
