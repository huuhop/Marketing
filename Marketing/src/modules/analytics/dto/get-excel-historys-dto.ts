import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetExcelHistorysDto {
  @IsNotEmpty()
  @IsNumber()
  readonly userId?: string;

  @IsNotEmpty()
  @IsString()
  readonly excelPage: string;
}
