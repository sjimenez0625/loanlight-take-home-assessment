import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (configService: ConfigService) => ({
  connection: {
    host: configService.get<string>('REDIS_HOST'),
    port: configService.get<number>('REDIS_PORT'),
    username: configService.get<string>('REDIS_USERNAME'),
    password: configService.get<string>('REDIS_PASSWORD'),
  },
});
