import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class ShoppingViewDto {
    @IsNotEmpty()
    @IsString()
    readonly date?: string;
}