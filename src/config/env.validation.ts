import * as Joi from 'joi';

/**
 * Fail fast at boot when the environment is incomplete, instead of failing
 * later on the first request that touches a missing value.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('v1'),
  APP_URL: Joi.string().uri().default('http://localhost:3001'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNC: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_ACTION_EXPIRES_IN: Joi.string().default('1h'),

  AUTH_REQUIRE_EMAIL_VERIFICATION: Joi.boolean().default(true),

  MAIL_DRIVER: Joi.string().valid('console', 'smtp').default('console'),
  MAIL_FROM: Joi.string().default('no-reply@example.com'),
  SMTP_HOST: Joi.string().allow('').when('MAIL_DRIVER', {
    is: 'smtp',
    then: Joi.required(),
  }),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow(''),
  SMTP_PASSWORD: Joi.string().allow(''),
});
