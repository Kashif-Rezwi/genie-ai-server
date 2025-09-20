import { IsNumber, IsString, IsOptional, IsEnum, IsUUID, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TransactionType } from '../../../entities';

export class AddCreditsDto {
    @IsUUID()
    userId: string;

    @IsNumber()
    @Min(1)
    @Max(10000)
    amount: number;

    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    packageId?: string;

    @IsOptional()
    @IsString()
    razorpayPaymentId?: string;
}

export class TransferCreditsDto {
    @IsUUID()
    fromUserId: string;

    @IsUUID()
    toUserId: string;

    @IsNumber()
    @Min(1)
    @Max(1000)
    amount: number;

    @IsOptional()
    @IsString()
    description?: string;
}

export class BatchCreditOperationDto {
    @IsUUID()
    userId: string;

    @IsNumber()
    @Min(1)
    amount: number;

    @IsString()
    description: string;
}

export class BatchAddCreditsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BatchCreditOperationDto)
    operations: BatchCreditOperationDto[];
}

export class TransactionHistoryQueryDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value))
    limit?: number = 50;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    offset?: number = 0;

    @IsOptional()
    @IsEnum(TransactionType)
    type?: TransactionType;

    @IsOptional()
    @Transform(({ value }) => new Date(value))
    startDate?: Date;

    @IsOptional()
    @Transform(({ value }) => new Date(value))
    endDate?: Date;
}