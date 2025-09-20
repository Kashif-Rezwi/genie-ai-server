import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsController } from './credits.controller';
import { CreditsService } from './services/credits.service';
import { CreditsAnalyticsService } from './services/credits-analytics.service';
import { User, CreditTransaction } from '../../entities';

@Module({
    imports: [TypeOrmModule.forFeature([User, CreditTransaction])],
    controllers: [CreditsController],
    providers: [CreditsService, CreditsAnalyticsService],
    exports: [CreditsService, CreditsAnalyticsService],
})
export class CreditsModule { }