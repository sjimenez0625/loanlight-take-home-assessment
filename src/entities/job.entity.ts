import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from './client.entity';
import { Result } from './result.entity';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, client => client.jobs, { onDelete: 'CASCADE' })
  client: Client;

  @Column({ default: 'processing' })
  status: 'processing' | 'completed' | 'failed';

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
