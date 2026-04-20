import dotenv from 'dotenv';

dotenv.config();

/**
 * Central environment configuration for the simulation server.
 */
export const config = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisEventsChannel: process.env.REDIS_EVENTS_CHANNEL || 'port:simulation:events',
};
