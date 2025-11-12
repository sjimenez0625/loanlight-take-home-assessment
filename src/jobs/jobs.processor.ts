import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job as DBJob } from 'src/entities/job.entity';
import { Result } from 'src/entities/result.entity';
import { Job as BullJob } from 'bullmq';
import pLimit from 'p-limit';
import { Logger } from '@nestjs/common';
import { hashStringToBigInt } from 'src/common/hash';
import { STATUS_TYPE } from 'src/common/result.constant';
import { STATUS_TYPE_JOB } from 'src/common/jobs.constant';

@Processor('faviconQueue')
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);
  private readonly MAX_CONCURRENCY = 10;
  private readonly TASK_TIMEOUT_MS = 2000;

  constructor(
    @InjectRepository(DBJob) private jobRepo: Repository<DBJob>,
    @InjectRepository(Result) private resultRepo: Repository<Result>,
  ) {
    super();
  }

  async process(job: BullJob<{ jobId: string }>): Promise<void> {
    const jobId = job.data.jobId;
    const dbJob = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['results'],
    });

    if (!dbJob) {
      console.warn(`Job not found: ${jobId}`);
      return;
    }

    dbJob.status = STATUS_TYPE_JOB.PROCESSING;
    await this.jobRepo.save(dbJob);

    const total = dbJob.results.length;
    const limit = pLimit(this.MAX_CONCURRENCY);

    let completed = dbJob.results.filter(
      (r) => r.status === STATUS_TYPE.SUCCESS,
    ).length;
    let failed = dbJob.results.filter(
      (r) => r.status === STATUS_TYPE.ERROR,
    ).length;

    const pendingResults = dbJob.results.filter(
      (r) => r.status === STATUS_TYPE.PENDING,
    );

    await Promise.all(
      pendingResults.map((result) =>
        limit(async () => {
          const hashJobId = hashStringToBigInt(`${dbJob.id}:${result.domain}`);
          await this.resultRepo.query('SELECT pg_advisory_xact_lock($1)', [
            hashJobId,
          ]);
          try {
            if (result.status === STATUS_TYPE.SUCCESS) return;

            const faviconUrl = await Promise.race([
              (async () => {
                const delay = Math.random() * 1500 + 500;
                await new Promise((res) => setTimeout(res, delay));
                return `https://${result.domain}/favicon.ico`;
              })(),
              new Promise<string>((_, reject) =>
                setTimeout(
                  () => reject(new Error('Timeout exceeded')),
                  this.TASK_TIMEOUT_MS,
                ),
              ),
            ]);

            result.faviconUrl = faviconUrl;
            result.status = STATUS_TYPE.SUCCESS;
            result.tries++;
            await this.resultRepo.save(result);
            completed++;
          } catch (error) {
            result.status = STATUS_TYPE.ERROR;
            result.error =
              error instanceof Error ? error.message : 'Unknown error';
            result.tries++;
            await this.resultRepo.save(result);
            failed++;
            this.logger.error(`Error en ${result.domain}: ${result.error}`);
          }

          const progress = Math.round((completed / total) * 100);
          await job.updateProgress(progress);
          await this.jobRepo.update(dbJob.id, {
            completed,
            failed,
          });
        }),
      ),
    );

    dbJob.status =
      failed > 0 ? STATUS_TYPE_JOB.FAILED : STATUS_TYPE_JOB.COMPLETED;
    dbJob.completed = completed;
    dbJob.failed = failed;
    await this.jobRepo.save(dbJob);

    console.log(`Job ${jobId} completed (${completed}/${total})`);
  }
}
