import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Job } from './job.entity';
import { STATUS_TYPE } from '../common/result.constant';

@Entity()
@Unique(['job', 'domain'])
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, (job) => job.results, { onDelete: 'CASCADE' })
  job: Job;

  @Column()
  domain: string;

  @Column({ nullable: true })
  faviconUrl: string;

  @Column({ type: 'enum', enum: STATUS_TYPE, default: STATUS_TYPE.PENDING })
  status: STATUS_TYPE;

  @Column({ nullable: true })
  error: string;

  @Column({ default: 0 })
  tries: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
