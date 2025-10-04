import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { ScalabilityService } from './services/scalability.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { AutoScalingService } from './services/auto-scaling.service';
import { ContainerOrchestrationService } from './services/container-orchestration.service';
import { ScalabilityController } from './scalability.controller';
import { User } from '../../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ScalabilityController],
  providers: [
    RedisService,
    ScalabilityService,
    LoadBalancerService,
    AutoScalingService,
    ContainerOrchestrationService,
  ],
  exports: [
    RedisService,
    ScalabilityService,
    LoadBalancerService,
    AutoScalingService,
    ContainerOrchestrationService,
  ],
})
export class ScalabilityModule {}
