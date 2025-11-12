import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterJobResult1762903164381 implements MigrationInterface {
    name = 'AlterJobResult1762903164381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."job_status_enum" AS ENUM('PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "job" ADD "status" "public"."job_status_enum" NOT NULL DEFAULT 'PROCESSING'`);
        await queryRunner.query(`ALTER TABLE "result" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."result_status_enum" AS ENUM('PENDING', 'SUCCESS', 'ERROR')`);
        await queryRunner.query(`ALTER TABLE "result" ADD "status" "public"."result_status_enum" NOT NULL DEFAULT 'PENDING'`);
        await queryRunner.query(`ALTER TABLE "result" ADD CONSTRAINT "UQ_351df0735e80afabf6f338fc299" UNIQUE ("jobId", "domain")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "result" DROP CONSTRAINT "UQ_351df0735e80afabf6f338fc299"`);
        await queryRunner.query(`ALTER TABLE "result" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."result_status_enum"`);
        await queryRunner.query(`ALTER TABLE "result" ADD "status" character varying NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."job_status_enum"`);
        await queryRunner.query(`ALTER TABLE "job" ADD "status" character varying NOT NULL DEFAULT 'processing'`);
    }

}
