export interface AppConfig {
  app: {
    env: string;
    port: number;
    prefix: string;
    url: string;
    frontendUrl: string;
  };
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    sync: boolean;
    logging: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    actionExpiresIn: string;
  };
  auth: {
    requireEmailVerification: boolean;
  };
  mail: {
    driver: 'console' | 'smtp';
    from: string;
    smtp: {
      host: string;
      port: number;
      user: string;
      password: string;
    };
  };
}

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === 'true';

export default (): AppConfig => ({
  app: {
    env: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    prefix: process.env.API_PREFIX,
    url: process.env.APP_URL,
    frontendUrl: process.env.FRONTEND_URL,
  },
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    sync: bool(process.env.DB_SYNC, false),
    logging: bool(process.env.DB_LOGGING, false),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    actionExpiresIn: process.env.JWT_ACTION_EXPIRES_IN,
  },
  auth: {
    requireEmailVerification: bool(
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      true,
    ),
  },
  mail: {
    driver: process.env.MAIL_DRIVER as 'console' | 'smtp',
    from: process.env.MAIL_FROM,
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
  },
});
