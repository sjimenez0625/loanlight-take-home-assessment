import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from './client.entity';
import { Result } from './result.entity';
import { STATUS_TYPE_JOB } from '../common/jobs.constant';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, client => client.jobs, { onDelete: 'CASCADE' })
  client: Client;

  @Column({type: 'enum', enum: STATUS_TYPE_JOB, default: STATUS_TYPE_JOB.PROCESSING })
  status: STATUS_TYPE_JOB

  @Column({ default: 0 })
  total: number;

  @Column({ default: 0 })
  completed: number;

  @Column({ default: 0 })
  failed: number;

  @OneToMany(() => Result, result => result.job, { cascade: true })
  results: Result[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
