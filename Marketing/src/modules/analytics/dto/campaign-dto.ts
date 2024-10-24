import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CampaignDto {
    @IsNotEmpty()
    @IsString()
    readonly type?: string;

    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly terms?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly pageNumber?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: string;
}