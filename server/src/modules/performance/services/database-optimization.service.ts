import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryCacheService } from './query-cache.service';
import { performanceConfig, PerformanceThresholds } from '../config/performance.config';

export interface QueryOptimizationResult {
  query: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  recommendations: string[];
}

export interface DatabaseMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
  };
  queryPerformance: {
    slowQueries: number;
    averageQueryTime: number;
    totalQueries: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalKeys: number;
  };
}

/**
 * Database optimization service
 * Provides database performance monitoring and optimization
 */
@Injectable()
export class DatabaseOptimizationService {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private readonly thresholds: PerformanceThresholds['database'];
  private readonly queryMetrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();

  constructor(
    private readonly dataSource: DataSource,
    private readonly queryCache: QueryCacheService
  ) {
    this.thresholds = performanceConfig().database;
  }

  /**
   * Analyze and optimize database queries
   * @returns Promise<QueryOptimizationResult[]> - Optimization results
   */
  async analyzeAndOptimizeQueries(): Promise<QueryOptimizationResult[]> {
    const results: QueryOptimizationResult[] = [];

    try {
      // Common query patterns to optimize
      const commonQueries = [
        {
          name: 'User Balance Query',
          query: 'SELECT "creditsBalance" FROM users WHERE id = $1',
          optimization: 'Add index on users.id if not exists',
        },
        {
          name: 'User Chats Query',
          query: 'SELECT * FROM chats WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
          optimization: 'Add composite index on (userId, createdAt)',
        },
        {
          name: 'Chat Messages Query',
          query: 'SELECT * FROM messages WHERE "chatId" = $1 ORDER BY "createdAt" ASC',
          optimization: 'Add composite index on (chatId, createdAt)',
        },
        {
          name: 'Credit Transactions Query',
          query:
            'SELECT * FROM credit_transactions WHERE "userId" = $1 AND type = $2 ORDER BY "createdAt" DESC',
          optimization: 'Add composite index on (userId, type, createdAt)',
        },
        {
          name: 'Payment History Query',
          query:
            'SELECT * FROM payments WHERE "userId" = $1 AND status = $2 ORDER BY "createdAt" DESC',
          optimization: 'Add composite index on (userId, status, createdAt)',
        },
      ];

      for (const queryInfo of commonQueries) {
        const result = await this.analyzeQuery(queryInfo.query, queryInfo.name);
        if (result) {
          results.push({
            query: queryInfo.query,
            originalTime: result.originalTime,
            optimizedTime: result.optimizedTime,
            improvement: result.improvement,
            recommendations: [queryInfo.optimization],
          });
        }
      }

      this.logger.log(`Analyzed ${results.length} queries for optimization`);
      return results;
    } catch (error) {
      this.logger.error('Error analyzing queries:', error);
      throw error;
    }
  }

  /**
   * Get database performance metrics
   * @returns Promise<DatabaseMetrics> - Database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get connection pool stats (TypeORM doesn't expose pool directly)
      const poolStats = {
        active: 0, // Would need to implement custom tracking
        idle: 0,
        total: 0,
        waiting: 0,
      };

      // Calculate query performance metrics
      let slowQueries = 0;
      let totalQueries = 0;
      let totalTime = 0;

      for (const [query, metrics] of this.queryMetrics.entries()) {
        totalQueries += metrics.count;
        totalTime += metrics.totalTime;
        if (metrics.avgTime > this.thresholds.slowQueryThreshold) {
          slowQueries++;
        }
      }

      const averageQueryTime = totalQueries > 0 ? totalTime / totalQueries : 0;

      // Get cache metrics
      const cacheMetrics = await this.queryCache.getCacheMetrics();

      return {
        connectionPool: poolStats,
        queryPerformance: {
          slowQueries,
          averageQueryTime,
          totalQueries,
        },
        cache: {
          hitRate: cacheMetrics.hitRate,
          missRate: 1 - cacheMetrics.hitRate,
          totalKeys: cacheMetrics.totalKeys,
        },
      };
    } catch (error) {
      this.logger.error('Error getting database metrics:', error);
      throw error;
    }
  }

  /**
   * Optimize database indexes
   * @returns Promise<string[]> - List of optimizations applied
   */
  async optimizeIndexes(): Promise<string[]> {
    const optimizations: string[] = [];

    try {
      // Check for missing indexes
      const missingIndexes = await this.checkMissingIndexes();

      for (const index of missingIndexes) {
        try {
          await this.dataSource.query(index.query);
          optimizations.push(`Created index: ${index.name}`);
          this.logger.log(`Created index: ${index.name}`);
        } catch (error) {
          this.logger.warn(`Failed to create index ${index.name}:`, error.message);
        }
      }

      // Update table statistics
      await this.updateTableStatistics();
      optimizations.push('Updated table statistics');

      this.logger.log(`Applied ${optimizations.length} database optimizations`);
      return optimizations;
    } catch (error) {
      this.logger.error('Error optimizing indexes:', error);
      throw error;
    }
  }

  /**
   * Enable query result caching
   * @param ttl - Cache TTL in seconds
   * @returns Promise<void>
   */
  async enableQueryCaching(ttl: number = 300): Promise<void> {
    try {
      // This would enable TypeORM query caching
      // For now, we'll use our custom query cache service
      this.logger.log(`Query caching enabled with TTL: ${ttl}s`);

      // Update cache configuration
      await this.queryCache.updateConfig({ defaultTtl: ttl });
    } catch (error) {
      this.logger.error('Error enabling query caching:', error);
      throw error;
    }
  }

  /**
   * Analyze a specific query
   * @param query - SQL query to analyze
   * @param name - Query name
   * @returns Promise<QueryOptimizationResult | null> - Analysis result
   */
  private async analyzeQuery(query: string, name: string): Promise<QueryOptimizationResult | null> {
    try {
      const startTime = Date.now();

      // Execute query with EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN ANALYZE ${query}`;
      const result = await this.dataSource.query(explainQuery);

      const executionTime = Date.now() - startTime;

      // Store metrics
      const existing = this.queryMetrics.get(query) || { count: 0, totalTime: 0, avgTime: 0 };
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      this.queryMetrics.set(query, existing);

      // Check if query needs optimization
      if (executionTime > this.thresholds.slowQueryThreshold) {
        // Calculate actual improvement potential based on query analysis
        const improvementPotential = this.calculateImprovementPotential(query, executionTime);

        return {
          query,
          originalTime: executionTime,
          optimizedTime: executionTime * (1 - improvementPotential / 100),
          improvement: improvementPotential,
          recommendations: this.generateQueryRecommendations(query, executionTime),
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error analyzing query ${name}:`, error.message);
      return null;
    }
  }

  /**
   * Check for missing indexes
   * @returns Promise<Array<{name: string, query: string}>> - Missing indexes
   */
  private async checkMissingIndexes(): Promise<Array<{ name: string; query: string }>> {
    const missingIndexes: Array<{ name: string; query: string }> = [];

    try {
      // Check for common missing indexes
      const indexChecks = [
        {
          name: 'users_email_index',
          query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
          checkQuery: `SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email'`,
        },
        {
          name: 'chats_user_id_index',
          query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_id ON chats("userId")',
          checkQuery: `SELECT 1 FROM pg_indexes WHERE tablename = 'chats' AND indexname = 'idx_chats_user_id'`,
        },
        {
          name: 'messages_chat_id_index',
          query:
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id ON messages("chatId")',
          checkQuery: `SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_chat_id'`,
        },
      ];

      for (const check of indexChecks) {
        try {
          const exists = await this.dataSource.query(check.checkQuery);
          if (exists.length === 0) {
            missingIndexes.push({
              name: check.name,
              query: check.query,
            });
          }
        } catch (error) {
          this.logger.warn(`Error checking index ${check.name}:`, error.message);
        }
      }

      return missingIndexes;
    } catch (error) {
      this.logger.error('Error checking missing indexes:', error);
      return [];
    }
  }

  /**
   * Update table statistics
   * @returns Promise<void>
   */
  private async updateTableStatistics(): Promise<void> {
    try {
      const tables = ['users', 'chats', 'messages', 'credit_transactions', 'payments'];

      for (const table of tables) {
        await this.dataSource.query(`ANALYZE ${table}`);
      }

      this.logger.log('Table statistics updated');
    } catch (error) {
      this.logger.error('Error updating table statistics:', error);
    }
  }

  /**
   * Get slow queries report
   * @returns Promise<Array<{query: string, avgTime: number, count: number}>> - Slow queries
   */
  async getSlowQueriesReport(): Promise<Array<{ query: string; avgTime: number; count: number }>> {
    const slowQueries: Array<{ query: string; avgTime: number; count: number }> = [];

    for (const [query, metrics] of this.queryMetrics.entries()) {
      if (metrics.avgTime > this.thresholds.slowQueryThreshold) {
        slowQueries.push({
          query,
          avgTime: metrics.avgTime,
          count: metrics.count,
        });
      }
    }

    return slowQueries.sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * Clear query metrics
   * @returns Promise<void>
   */
  async clearQueryMetrics(): Promise<void> {
    this.queryMetrics.clear();
    this.logger.log('Query metrics cleared');
  }

  /**
   * Calculate improvement potential for a query
   * @param query - SQL query
   * @param executionTime - Current execution time
   * @returns number - Improvement potential percentage
   */
  private calculateImprovementPotential(query: string, executionTime: number): number {
    let potential = 0;

    // Check for common optimization opportunities
    if (query.toLowerCase().includes('select *')) {
      potential += 20; // Selecting specific columns can improve performance
    }

    if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
      potential += 15; // Adding LIMIT can improve performance
    }

    if (query.toLowerCase().includes('like') && query.toLowerCase().includes('%')) {
      potential += 25; // Full-text search optimization
    }

    if (query.toLowerCase().includes('join') && query.toLowerCase().includes('where')) {
      potential += 30; // Join optimization with proper indexes
    }

    if (query.toLowerCase().includes('group by') && query.toLowerCase().includes('having')) {
      potential += 20; // Group by optimization
    }

    // Cap improvement potential at 80%
    return Math.min(potential, 80);
  }

  /**
   * Generate specific recommendations for a query
   * @param query - SQL query
   * @param executionTime - Current execution time
   * @returns string[] - Specific recommendations
   */
  private generateQueryRecommendations(query: string, executionTime: number): string[] {
    const recommendations: string[] = [];

    if (query.toLowerCase().includes('select *')) {
      recommendations.push('Replace SELECT * with specific column names');
    }

    if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
      recommendations.push('Add LIMIT clause to ORDER BY queries');
    }

    if (query.toLowerCase().includes('like') && query.toLowerCase().includes('%')) {
      recommendations.push('Consider full-text search indexes for LIKE queries');
    }

    if (query.toLowerCase().includes('join')) {
      recommendations.push('Ensure proper indexes exist on join columns');
    }

    if (query.toLowerCase().includes('group by')) {
      recommendations.push('Add indexes on GROUP BY columns');
    }

    if (executionTime > 5000) {
      recommendations.push('Consider query restructuring or breaking into smaller queries');
    }

    // Default recommendations
    recommendations.push('Add appropriate indexes');
    recommendations.push('Use query caching');

    return recommendations;
  }
}
