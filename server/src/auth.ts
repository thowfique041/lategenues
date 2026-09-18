import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { User } from './models.js';

export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = await User.findById(payload.sub);
    if (!req.user?.active) return res.status(401).json({ message: 'Account unavailable' });
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}

export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role)
  ? next()
  : res.status(403).json({ message: 'You do not have permission for this action' });
