import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'src/entities/client.entity';
import { Job } from 'src/entities/job.entity';
import { Result } from 'src/entities/result.entity';
import { BullModule } from '@nestjs/bullmq';
import { JobsProcessor } from './jobs.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Job, Result]),
    BullModule.registerQueue({ name: 'faviconQueue' }),
  ],
  providers: [JobsService, JobsProcessor],
  controllers: [JobsController],
})
export class JobsModule {}
