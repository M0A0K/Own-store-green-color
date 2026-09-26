import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/repository.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
    role: string;
  };
  isAdminToken?: boolean;
}

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || 'ownverse-production-hmac-secret-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function createAdminSessionToken(identifier: string): string {
  const payload = JSON.stringify({
    sub: identifier,
    role: 'admin',
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  try {
    const [base64Payload, signature] = token.split('.');
    if (!base64Payload || !signature) return false;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Payload)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (!decoded || decoded.role !== 'admin' || decoded.exp < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const adminTokenHeader = req.headers['x-admin-token'];

  if (typeof adminTokenHeader === 'string' && verifyAdminSessionToken(adminTokenHeader)) {
    req.isAdminToken = true;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      const dbUser = await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || 'user@ownverse.mc',
        decodedToken.name || null
      );
      req.dbUser = dbUser;
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Firebase ID token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || 'user@ownverse.mc',
      decodedToken.name || null
    );
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const adminTokenHeader = req.headers['x-admin-token'];
  if (typeof adminTokenHeader === 'string' && verifyAdminSessionToken(adminTokenHeader)) {
    req.isAdminToken = true;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Admin authorization required. Sign in with Google or unlock with your Admin Access Key.',
    });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || 'user@ownverse.mc',
      decodedToken.name || null
    );
    req.dbUser = dbUser;

    if (dbUser.role === 'admin') {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: Your account does not have Administrator privileges yet.',
    });
  } catch (error) {
    console.error('Admin verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
};
