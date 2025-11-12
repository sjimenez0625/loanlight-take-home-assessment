import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
export class CreateJobDto {
  @IsString()
  client_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  domains: string[];
}
