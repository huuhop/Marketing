import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class DownloadExcelDto {
    @IsNotEmpty()
    @IsString()
    readonly fileKey?: string;
}