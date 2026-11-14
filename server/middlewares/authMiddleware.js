import jwt from 'jsonwebtoken';

const getJwtSecret = () =>
  process.env.JWT_SECRET || 'chronos_super_secret_64_char_hex_key_replace_in_production_2026';

const getAdminSecret = () =>
  process.env.ADMIN_COOKIE_SECRET ||
  'chronos_admin_cookie_signing_secret_replace_in_production_2026';

export const signVaultToken = (role) => {
  return jwt.sign({ role }, getJwtSecret(), { expiresIn: '12h' });
};

export const verifyVaultTokenString = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export const signAdminSessionToken = () => {
  return jwt.sign({ role: 'ADMIN' }, getAdminSecret(), { expiresIn: '24h' });
};

export const verifyAdminSessionToken = (token) => {
  return jwt.verify(token, getAdminSecret());
};

/**
 * Protects Vault routes (/memories, /chat) via Authorization: Bearer <token>
 */
export const jwtMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization Bearer token.',
        details: null,
      },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyVaultTokenString(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Vault token expired or invalid.',
        details: null,
      },
    });
  }
};

/**
 * Protects Admin God-Mode routes via HttpOnly Cookie (`admin_session`)
 * Also supports `x-admin-token` header fallback for local cross-port dev convenience.
 */
export const adminAuthMiddleware = (req, res, next) => {
  const token = req.cookies?.admin_session || req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'ADMIN_UNAUTHORIZED',
        message: 'Admin God-Mode session required.',
        details: null,
      },
    });
  }

  try {
    const decoded = verifyAdminSessionToken(token);
    if (decoded.role !== 'ADMIN') {
      throw new Error('Invalid role');
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: 'ADMIN_UNAUTHORIZED',
        message: 'Admin session expired or invalid.',
        details: null,
      },
    });
  }
};

