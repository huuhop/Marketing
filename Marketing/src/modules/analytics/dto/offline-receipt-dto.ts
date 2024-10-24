import { IsNotEmpty, IsString } from "class-validator";

export class OfflineReceiptDto {
    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;
}