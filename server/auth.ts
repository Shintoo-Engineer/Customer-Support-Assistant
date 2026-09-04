import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, UserRecord } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'customer-support-assistant-super-secret-key-2026';
const JWT_EXPIRES_IN = '24h';

export interface AuthenticatedUserPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
}

export function signUserToken(user: UserRecord): string {
  const payload: AuthenticatedUserPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyUserToken(token: string): AuthenticatedUserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Authentication Middleware
export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.substring(7);
  const payload = verifyUserToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }

  req.user = payload;
  next();
}

// Authorization Middleware
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied: Your role (${req.user.role}) is not authorized to access this resource. Required role: ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}
