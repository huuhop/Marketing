import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class TrackingSkuCampaignOrderDto {
    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly sku?: string;

    @IsNotEmpty()
    @IsString()
    readonly campaignId?: string;
}