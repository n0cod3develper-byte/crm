import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PERMISSIONS_CACHE_TTL_SECONDS: z.string().default('300').transform(Number),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),
  GRAPH_TENANT_ID: z.string().optional(),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
  GRAPH_SENDER_MAILBOX: z.string().optional(),
  SOAT_ALERT_RECIPIENTS: z.string().optional(),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().optional(),
  API_BASE_URL: z.string().default('http://localhost:3005'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin123'),
  S3_BUCKET: z.string().default('crm-files'),
  S3_REGION: z.string().default('us-east-1'),

  OPENAI_API_KEY: z.string().optional(),

  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@cargar.com.co'),
  EMAIL_FROM_NAME: z.string().default('CARGAR SAS CRM'),

  ASTERISK_ENABLED: z.string().default('false').transform(v => v === 'true'),
  ASTERISK_AMI_HOST: z.string().optional(),
  ASTERISK_AMI_PORT: z.string().default('5038').transform(Number),
  ASTERISK_AMI_USER: z.string().optional(),
  ASTERISK_AMI_SECRET: z.string().optional(),
  ASTERISK_ARI_URL: z.string().optional(),
  ASTERISK_ARI_USER: z.string().optional(),
  ASTERISK_ARI_PASSWORD: z.string().optional(),
  ASTERISK_RECORDING_SYNC_INTERVAL: z.string().default('300').transform(Number),

  SENTRY_DSN: z.string().optional(),

  OAUTH_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
