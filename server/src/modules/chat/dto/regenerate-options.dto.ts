import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegenerateOptionsDto {
    @ApiProperty({
        description: 'AI model to use for regeneration',
        required: false,
        example: 'gpt-3.5-turbo',
    })
    @IsOptional()
    @IsString()
    model?: string;
}
