import { IsString, IsOptional, IsArray, ValidateNested, IsIn, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
    @IsIn(['user', 'assistant', 'system'])
    role: 'user' | 'assistant' | 'system';

    @IsString()
    content: string;
}

export class AIRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    messages: MessageDto[];

    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsString()
    systemPrompt?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(4000)
    maxTokens?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(2)
    temperature?: number;
}