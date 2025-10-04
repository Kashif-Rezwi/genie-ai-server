import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScalabilityService, ScalingDecision, ScalingMetrics } from './scalability.service';

export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  scaleUpCooldown: number; // milliseconds
  scaleDownCooldown: number; // milliseconds
  scaleUpThreshold: number; // confidence threshold
  scaleDownThreshold: number; // confidence threshold
  metricsWindow: number; // milliseconds
  healthCheckInterval: number; // milliseconds
}

export interface ScalingEvent {
  id: string;
  timestamp: Date;
  action: 'scale_up' | 'scale_down' | 'no_action';
  reason: string;
  confidence: number;
  currentInstances: number;
  targetInstances: number;
  metrics: ScalingMetrics;
  success: boolean;
  error?: string;
}

export interface AutoScalingStats {
  totalEvents: number;
  successfulScales: number;
  failedScales: number;
  averageConfidence: number;
  lastScaleTime: Date | null;
  currentInstances: number;
  targetInstances: number;
  recentEvents: ScalingEvent[];
}

/**
 * Auto-Scaling Service
 * Handles automatic scaling based on metrics and thresholds
 */
@Injectable()
export class AutoScalingService {
  private readonly logger = new Logger(AutoScalingService.name);
  private readonly eventsPrefix = 'autoscaling:events:';
  private readonly configPrefix = 'autoscaling:config:';
  private readonly cooldownPrefix = 'autoscaling:cooldown:';

  // Default auto-scaling configuration
  private readonly defaultConfig: AutoScalingConfig = {
    enabled: true,
    minInstances: 1,
    maxInstances: 10,
    scaleUpCooldown: 300000, // 5 minutes
    scaleDownCooldown: 600000, // 10 minutes
    scaleUpThreshold: 0.7, // 70% confidence
    scaleDownThreshold: 0.8, // 80% confidence
    metricsWindow: 300000, // 5 minutes
    healthCheckInterval: 30000, // 30 seconds
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly scalabilityService: ScalabilityService,
  ) {}

  /**
   * Initialize auto-scaling with configuration
   * @param config - Auto-scaling configuration
   * @returns Promise<void>
   */
  async initialize(config: Partial<AutoScalingConfig> = {}): Promise<void> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      await this.redis.setex(
        `${this.configPrefix}main`,
        86400,
        JSON.stringify(finalConfig),
      );

      this.logger.log('Auto-scaling initialized', finalConfig);
    } catch (error) {
      this.logger.error('Error initializing auto-scaling:', error);
      throw error;
    }
  }

  /**
   * Enable auto-scaling
   * @returns Promise<void>
   */
  async enable(): Promise<void> {
    try {
      const config = await this.getConfig();
      config.enabled = true;
      await this.updateConfig(config);
      
      this.logger.log('Auto-scaling enabled');
    } catch (error) {
      this.logger.error('Error enabling auto-scaling:', error);
      throw error;
    }
  }

  /**
   * Disable auto-scaling
   * @returns Promise<void>
   */
  async disable(): Promise<void> {
    try {
      const config = await this.getConfig();
      config.enabled = false;
      await this.updateConfig(config);
      
      this.logger.log('Auto-scaling disabled');
    } catch (error) {
      this.logger.error('Error disabling auto-scaling:', error);
      throw error;
    }
  }

  /**
   * Get auto-scaling configuration
   * @returns Promise<AutoScalingConfig> - Auto-scaling configuration
   */
  async getConfig(): Promise<AutoScalingConfig> {
    try {
      const config = await this.redis.get(`${this.configPrefix}main`);
      if (config) {
        return JSON.parse(config) as AutoScalingConfig;
      }
      return this.defaultConfig;
    } catch (error) {
      this.logger.error('Error getting auto-scaling config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Update auto-scaling configuration
   * @param config - New configuration
   * @returns Promise<void>
   */
  async updateConfig(config: AutoScalingConfig): Promise<void> {
    try {
      await this.redis.setex(
        `${this.configPrefix}main`,
        86400,
        JSON.stringify(config),
      );
      
      this.logger.log('Auto-scaling configuration updated');
    } catch (error) {
      this.logger.error('Error updating auto-scaling config:', error);
      throw error;
    }
  }

  /**
   * Get auto-scaling statistics
   * @returns Promise<AutoScalingStats> - Auto-scaling statistics
   */
  async getStats(): Promise<AutoScalingStats> {
    try {
      const events = await this.getRecentEvents(50);
      const totalEvents = events.length;
      const successfulScales = events.filter(e => e.success && e.action !== 'no_action').length;
      const failedScales = events.filter(e => !e.success).length;
      const averageConfidence = events.length > 0 
        ? events.reduce((sum, e) => sum + e.confidence, 0) / events.length 
        : 0;

      const lastScaleEvent = events.find(e => e.action !== 'no_action');
      const lastScaleTime = lastScaleEvent ? lastScaleEvent.timestamp : null;

      const currentInstances = await this.getCurrentInstanceCount();
      const targetInstances = await this.getTargetInstanceCount();

      return {
        totalEvents,
        successfulScales,
        failedScales,
        averageConfidence,
        lastScaleTime,
        currentInstances,
        targetInstances,
        recentEvents: events.slice(0, 10),
      };
    } catch (error) {
      this.logger.error('Error getting auto-scaling stats:', error);
      throw error;
    }
  }

  /**
   * Get recent scaling events
   * @param limit - Number of events to return
   * @returns Promise<ScalingEvent[]> - Recent scaling events
   */
  async getRecentEvents(limit: number = 50): Promise<ScalingEvent[]> {
    try {
      const keys = await this.redis.keys(`${this.eventsPrefix}*`);
      const events: ScalingEvent[] = [];

      if (keys.length === 0) {
        return events;
      }

      // Sort by timestamp (newest first)
      keys.sort((a, b) => b.localeCompare(a));
      
      const limitedKeys = keys.slice(0, limit);

      for (const key of limitedKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const event = JSON.parse(data) as ScalingEvent;
          events.push(event);
        }
      }

      return events;
    } catch (error) {
      this.logger.error('Error getting recent events:', error);
      return [];
    }
  }

  /**
   * Manually trigger scaling decision
   * @returns Promise<ScalingEvent> - Scaling event
   */
  async triggerScalingDecision(): Promise<ScalingEvent> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        throw new Error('Auto-scaling is disabled');
      }

      const decision = await this.scalabilityService.makeScalingDecision();
      const event = await this.executeScalingDecision(decision);
      
      return event;
    } catch (error) {
      this.logger.error('Error triggering scaling decision:', error);
      throw error;
    }
  }

  /**
   * Execute scaling decision
   * @param decision - Scaling decision to execute
   * @returns Promise<ScalingEvent> - Scaling event
   */
  private async executeScalingDecision(decision: ScalingDecision): Promise<ScalingEvent> {
    try {
      const config = await this.getConfig();
      const eventId = this.generateEventId();
      
      let success = false;
      let error: string | undefined;

      // Check cooldown periods
      if (decision.action !== 'no_action' && await this.isInCooldown(decision.action)) {
        const event: ScalingEvent = {
          id: eventId,
          timestamp: new Date(),
          action: 'no_action',
          reason: 'In cooldown period',
          confidence: decision.confidence,
          currentInstances: decision.currentInstances,
          targetInstances: decision.currentInstances,
          metrics: decision.metrics,
          success: true,
        };

        await this.storeEvent(event);
        return event;
      }

      // Validate scaling limits
      if (decision.action === 'scale_up' && decision.recommendedInstances > config.maxInstances) {
        decision.recommendedInstances = config.maxInstances;
      } else if (decision.action === 'scale_down' && decision.recommendedInstances < config.minInstances) {
        decision.recommendedInstances = config.minInstances;
      }

      // Check confidence thresholds
      const threshold = decision.action === 'scale_up' 
        ? config.scaleUpThreshold 
        : config.scaleDownThreshold;

      if (decision.confidence < threshold) {
        const event: ScalingEvent = {
          id: eventId,
          timestamp: new Date(),
          action: 'no_action',
          reason: `Confidence ${decision.confidence} below threshold ${threshold}`,
          confidence: decision.confidence,
          currentInstances: decision.currentInstances,
          targetInstances: decision.currentInstances,
          metrics: decision.metrics,
          success: true,
        };

        await this.storeEvent(event);
        return event;
      }

      // Execute scaling action
      try {
        if (decision.action === 'scale_up') {
          await this.scaleUp(decision.recommendedInstances);
        } else if (decision.action === 'scale_down') {
          await this.scaleDown(decision.recommendedInstances);
        }
        
        success = true;
        
        // Set cooldown
        if (decision.action !== 'no_action') {
          await this.setCooldown(decision.action);
        }
        
        this.logger.log(`Scaling ${decision.action} executed successfully`, {
          currentInstances: decision.currentInstances,
          targetInstances: decision.recommendedInstances,
          confidence: decision.confidence,
        });
      } catch (scalingError) {
        error = scalingError.message;
        this.logger.error(`Scaling ${decision.action} failed:`, scalingError);
      }

      const event: ScalingEvent = {
        id: eventId,
        timestamp: new Date(),
        action: decision.action,
        reason: decision.reason,
        confidence: decision.confidence,
        currentInstances: decision.currentInstances,
        targetInstances: decision.recommendedInstances,
        metrics: decision.metrics,
        success,
        error,
      };

      await this.storeEvent(event);
      return event;
    } catch (error) {
      this.logger.error('Error executing scaling decision:', error);
      throw error;
    }
  }

  /**
   * Scale up to target instances
   * @param targetInstances - Target number of instances
   * @returns Promise<void>
   */
  private async scaleUp(targetInstances: number): Promise<void> {
    try {
      // In a real implementation, this would call your orchestration platform
      // For now, we'll just update the instance count in Redis
      await this.redis.setex('scaling:instance_count', 3600, targetInstances.toString());
      
      this.logger.log(`Scaled up to ${targetInstances} instances`);
    } catch (error) {
      this.logger.error('Error scaling up:', error);
      throw error;
    }
  }

  /**
   * Scale down to target instances
   * @param targetInstances - Target number of instances
   * @returns Promise<void>
   */
  private async scaleDown(targetInstances: number): Promise<void> {
    try {
      // In a real implementation, this would call your orchestration platform
      // For now, we'll just update the instance count in Redis
      await this.redis.setex('scaling:instance_count', 3600, targetInstances.toString());
      
      this.logger.log(`Scaled down to ${targetInstances} instances`);
    } catch (error) {
      this.logger.error('Error scaling down:', error);
      throw error;
    }
  }

  /**
   * Check if action is in cooldown period
   * @param action - Scaling action
   * @returns Promise<boolean> - Whether in cooldown
   */
  private async isInCooldown(action: 'scale_up' | 'scale_down'): Promise<boolean> {
    try {
      const cooldownKey = `${this.cooldownPrefix}${action}`;
      const cooldownEnd = await this.redis.get(cooldownKey);
      
      if (!cooldownEnd) {
        return false;
      }
      
      return Date.now() < parseInt(cooldownEnd);
    } catch (error) {
      this.logger.error(`Error checking cooldown for ${action}:`, error);
      return false;
    }
  }

  /**
   * Set cooldown period for action
   * @param action - Scaling action
   * @returns Promise<void>
   */
  private async setCooldown(action: 'scale_up' | 'scale_down'): Promise<void> {
    try {
      const config = await this.getConfig();
      const cooldownDuration = action === 'scale_up' 
        ? config.scaleUpCooldown 
        : config.scaleDownCooldown;
      
      const cooldownKey = `${this.cooldownPrefix}${action}`;
      const cooldownEnd = Date.now() + cooldownDuration;
      
      await this.redis.setex(cooldownKey, Math.ceil(cooldownDuration / 1000), cooldownEnd.toString());
    } catch (error) {
      this.logger.error(`Error setting cooldown for ${action}:`, error);
    }
  }

  /**
   * Get current instance count
   * @returns Promise<number> - Current instance count
   */
  private async getCurrentInstanceCount(): Promise<number> {
    try {
      const count = await this.redis.get('scaling:instance_count');
      return count ? parseInt(count) : 1;
    } catch (error) {
      this.logger.error('Error getting current instance count:', error);
      return 1;
    }
  }

  /**
   * Get target instance count
   * @returns Promise<number> - Target instance count
   */
  private async getTargetInstanceCount(): Promise<number> {
    try {
      const count = await this.redis.get('scaling:target_instance_count');
      return count ? parseInt(count) : 1;
    } catch (error) {
      this.logger.error('Error getting target instance count:', error);
      return 1;
    }
  }

  /**
   * Store scaling event
   * @param event - Scaling event to store
   * @returns Promise<void>
   */
  private async storeEvent(event: ScalingEvent): Promise<void> {
    try {
      const key = `${this.eventsPrefix}${event.id}`;
      await this.redis.setex(key, 86400, JSON.stringify(event)); // 24 hours TTL
    } catch (error) {
      this.logger.error('Error storing scaling event:', error);
    }
  }

  /**
   * Generate unique event ID
   * @returns string - Event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Scheduled auto-scaling check
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledScalingCheck(): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        return;
      }

      this.logger.debug('Running scheduled scaling check');
      
      const decision = await this.scalabilityService.makeScalingDecision();
      await this.executeScalingDecision(decision);
    } catch (error) {
      this.logger.error('Error in scheduled scaling check:', error);
    }
  }

  /**
   * Scheduled health check
   * Runs every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledHealthCheck(): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        return;
      }

      await this.scalabilityService.performHealthCheck();
    } catch (error) {
      this.logger.error('Error in scheduled health check:', error);
    }
  }
}
