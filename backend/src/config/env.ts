import fastifyEnv from '@fastify/env';
import type { FastifyInstance } from 'fastify';

export type AppEnvironment = 'local' | 'staging' | 'production' | 'test';

export interface AppConfig {
  NODE_ENV: AppEnvironment;
  HOST: string;
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  SUPER_ADMIN_EMAIL?: string;
  SESSION_SECRET: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

const schema = {
  type: 'object',
  required: [
    'NODE_ENV',
    'HOST',
    'PORT',
    'LOG_LEVEL',
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'SESSION_SECRET'
  ],
  properties: {
    NODE_ENV: {
      type: 'string',
      enum: ['local', 'staging', 'production', 'test'],
      default: 'local'
    },
    HOST: {
      type: 'string',
      default: '127.0.0.1'
    },
    PORT: {
      type: 'number',
      default: 4000
    },
    LOG_LEVEL: {
      type: 'string',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info'
    },
    DATABASE_URL: {
      type: 'string'
    },
    GOOGLE_CLIENT_ID: {
      type: 'string'
    },
    GOOGLE_CLIENT_SECRET: {
      type: 'string'
    },
    GOOGLE_CALLBACK_URL: {
      type: 'string'
    },
    SUPER_ADMIN_EMAIL: {
      type: 'string'
    },
    SESSION_SECRET: {
      type: 'string',
      minLength: 16
    }
  }
} as const;

export async function registerEnvironment(app: FastifyInstance): Promise<void> {
  await app.register(fastifyEnv, {
    confKey: 'config',
    dotenv: true,
    schema
  });
}
