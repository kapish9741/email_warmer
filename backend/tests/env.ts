// Test-only defaults so config validation passes without a real .env.
process.env.DATABASE_URL ??= "postgresql://localhost/test"
process.env.REDIS_URL ??= "redis://localhost:6379"
process.env.APP_ENCRYPTION_KEY ??= "test-encryption-key-at-least-32-characters"
process.env.JWT_SECRET ??= "test-jwt-secret-value"
