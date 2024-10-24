import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CampaignDetailDto {

    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly pageNumber?: number;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: number;

    @IsNotEmpty()
    readonly campaignId?: string;

    readonly campaignName?: string;

    readonly transactionId?: string;
}

export class CampaignDetailOrderStatusDto {
    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

    @IsNotEmpty()
    readonly campaignId?: string;

    readonly campaignName?: string;

    readonly transactionId?: string;
}