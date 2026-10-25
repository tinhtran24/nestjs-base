import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('db', { infer: true });
        return {
          dialect: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          // Models are registered per feature module via SequelizeModule.forFeature().
          autoLoadModels: true,
          synchronize: db.sync,
          logging: db.logging ? console.log : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
