import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (configService: ConfigService) => ({
  connection: {
    host: configService.get('REDIS_HOST'),
    port: +configService.get('REDIS_PORT'),
  },
});
