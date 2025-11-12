import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Job } from './job.entity';

@Entity()
export class Result{
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Job, job => job.results, { onDelete: 'CASCADE' })
  job: Job;

  @Column()
  domain: string;

  @Column({ nullable: true })
  faviconUrl: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'success' | 'error';

  @Column({ nullable: true })
  error: string;

  @Column({ default: 0 })
  tries: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
