import { IsNotEmpty, IsString } from "class-validator";

export class GetItemsQuery {
    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;
}