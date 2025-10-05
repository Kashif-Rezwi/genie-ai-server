import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScalabilityService } from './services/scalability.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { AutoScalingService } from './services/auto-scaling.service';
import { ContainerOrchestrationService } from './services/container-orchestration.service';
import { KubernetesConfigService } from './services/kubernetes-config.service';
import { DockerConfigService } from './services/docker-config.service';
import { OrchestrationStatsService } from './services/orchestration-stats.service';
import { ScalabilityController } from './scalability.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ScalabilityController],
  providers: [
    ScalabilityService,
    LoadBalancerService,
    AutoScalingService,
    ContainerOrchestrationService,
    KubernetesConfigService,
    DockerConfigService,
    OrchestrationStatsService,
  ],
  exports: [
    ScalabilityService,
    LoadBalancerService,
    AutoScalingService,
    ContainerOrchestrationService,
    KubernetesConfigService,
    DockerConfigService,
    OrchestrationStatsService,
  ],
})
export class ScalabilityModule {}
