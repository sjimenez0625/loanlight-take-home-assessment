import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Job } from './job.entity';

@Entity()
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clientId: string;

  @OneToMany(() => Job, job => job.client)
  jobs: Job[];

  @CreateDateColumn()
  createdAt: Date;
}
