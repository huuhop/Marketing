import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class RequestExportExcelDto {
  @IsNotEmpty()
  readonly perPage?: string;

  @IsNotEmpty()
  @IsNumber()
  readonly userId?: string;

  @IsNotEmpty()
  @IsString()
  readonly nameUserFile?: string;

  // @IsNotEmpty()
  // @IsString()
  // readonly excelPage?: string;

  readonly filters?: Record<string, any>;
}
