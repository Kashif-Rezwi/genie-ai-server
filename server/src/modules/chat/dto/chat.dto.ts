import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChatDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    systemPrompt?: string;

    @IsOptional()
    @IsString()
    model?: string;
}

export class UpdateChatDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    systemPrompt?: string;
}

export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(50000) // Increased from 10KB to 50KB for better user experience
    content: string;

    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    systemPrompt?: string;
}

export class ChatListQueryDto {
    @IsOptional()
    @Type(() => Number)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    offset?: number = 0;

    @IsOptional()
    @IsString()
    search?: string;
}
