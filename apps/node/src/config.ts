/**
 * Application configuration
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  host: z.string().default('0.0.0.0'),
  
  // Database
  databaseUrl: z.string(),
  
  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  
  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.coerce.number().default(604800), // 7 days in seconds
  
  // CORS
  corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  
  // Dev mode
  devMode: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(false)
  ),
});

function loadConfig() {
  const env = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    corsOrigins: process.env.CORS_ORIGINS?.split(','),
    devMode: process.env.DEV_MODE,
  };

  const result = ConfigSchema.safeParse(env);
  
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const config = loadConfig();


