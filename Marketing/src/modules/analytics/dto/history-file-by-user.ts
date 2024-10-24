import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class HistoryFileByUserDto {
    @IsNotEmpty()
    @IsNumber()
    readonly userId?: string;

    @IsNotEmpty()
    @IsString()
    readonly excelPage?: string;
}