import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from 'src/entities/dtos/create-job.dto';
import { PaginationDto } from 'src/entities/dtos/pagination.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Post()
  async createJob(@Body() createJobDto: CreateJobDto) {
    const job = await this.service.createJob(createJobDto);
    return job;
  }
  @Get(':jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.service.getStatus(jobId);
    if (!status) {
      return { error: 'Job not found' };
    }
    return status;
  }

  @Get(':jobId/results')
  async getResults(
    @Param('jobId') jobId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const { page = 1, per_page = 20 } = paginationDto;
    return this.service.getResult(jobId, page, per_page);
  }

  @Get(':jobId/download')
  async downloadJob(@Param('jobId') jobId: string): Promise<StreamableFile> {
    return this.service.downloadJobCsv(jobId);
  }
}
