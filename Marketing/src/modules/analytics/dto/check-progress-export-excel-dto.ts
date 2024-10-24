import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class CheckProgressExportExcelDto {
  @IsNotEmpty()
  @IsString()
  readonly fileKey: string;
}
