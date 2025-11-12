import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Client } from 'src/entities/client.entity';
import { CreateJobDto } from 'src/entities/dtos/create-job.dto';
import { Job } from 'src/entities/job.entity';
import { Result } from 'src/entities/result.entity';
import { Repository } from 'typeorm';
import { format } from 'fast-csv';
import { PassThrough, Readable } from 'stream';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Result) private resultRepo: Repository<Result>,
    @InjectQueue('faviconQueue') private faviconQueue: Queue,
  ) {}

  async createJob(data: CreateJobDto) {
    let client = await this.clientRepo.findOne({
      where: { clientId: data.client_id },
    });
    if (!client) {
      client = this.clientRepo.create({ clientId: data.client_id });
      await this.clientRepo.save(client);
    }

    const uniqueDomains = Array.from(new Set(data.domains));

    const job = this.jobRepo.create({
      client,
       total: uniqueDomains.length,
  results: uniqueDomains.map(d => ({ domain: d })),
    });
    await this.jobRepo.save(job);

    await this.faviconQueue.add(
      'process-job',
      { jobId: job.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    return { job_id: job.id, status: job.status };
  }

  async getStatus(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return null;

    const progress =
      job.total == 0 ? 100 : Math.round((job.completed / job.total) * 100);

    return {
      job_id: job.id,
      status: job.status,
      progress,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
    };
  }

  async getResult(jobId: string, page: number, per_page: number) {
    const [results, total] = await this.resultRepo.findAndCount({
      where: { job: { id: jobId } },
      skip: (page - 1) * per_page,
      take: per_page,
      order: { createdAt: 'ASC' },
    });
    if (!results) throw new NotFoundException(`Job ${jobId} not found`);
    return {
      results: results.map((r) => ({
        domain: r.domain,
        favicon_url: r.faviconUrl,
        status: r.status,
        error: r.error,
      })),
      page,
      per_page,
      total,
    };
  }

  async downloadJobCsv(jobId: string): Promise<StreamableFile> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['results'],
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const stream = new PassThrough();
    const csvStream = format({ headers: true });

    csvStream.pipe(stream);
    for (const result of job.results) {
      csvStream.write({
        domain: result.domain,
        status: result.status,
        faviconUrl: result.faviconUrl || '',
        error: result.error || '',
        tries: result.tries || 0,
      });
    }

    csvStream.end();

    return new StreamableFile(stream, {
      type: 'text/csv',
      disposition: `attachment; filename="job-${jobId}.csv"`,
    });
  }
}
