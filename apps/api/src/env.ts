export function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'staging', 'production'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}`);
  }

  // DATABASE_URL is always required
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // JWT_SECRET is always required
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (nodeEnv === 'production' && process.env.AUTH_MODE === 'DEMO') {
    throw new Error('AUTH_MODE=DEMO is not allowed in production');
  }

  if (nodeEnv !== 'development') {
    if (!process.env.HOST) {
      throw new Error(
        'HOST environment variable must be set in staging/production',
      );
    }
    if (!process.env.CORS_ORIGINS) {
      throw new Error(
        'CORS_ORIGINS environment variable must be set in staging/production',
      );
    }
  }

  const port = Number(process.env.PORT ?? 3001);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
}
