import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';

export interface MetricData {
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    value: number;
    labels?: Record<string, string>;
    timestamp: Date;
}

export interface CustomMetric {
    name: string;
    description: string;
    type: 'counter' | 'gauge' | 'histogram';
    labels?: string[];
    buckets?: number[]; // For histograms
}

@Injectable()
export class MetricsService {
    private metrics: Map<string, MetricData[]> = new Map();
    private counters: Map<string, { value: number; labels: Record<string, string> }> = new Map();
    private gauges: Map<string, { value: number; labels: Record<string, string> }> = new Map();
    private histograms: Map<string, { values: number[]; labels: Record<string, string> }> = new Map();

    private customMetrics: Map<string, CustomMetric> = new Map();

    constructor(private readonly loggingService: LoggingService) {
        this.initializeDefaultMetrics();
        this.startMetricsCollection();
    }

    private initializeDefaultMetrics() {
        // HTTP metrics
        this.registerCustomMetric({
            name: 'http_requests_total',
            description: 'Total HTTP requests',
            type: 'counter',
            labels: ['method', 'status', 'endpoint'],
        });

        this.registerCustomMetric({
            name: 'http_request_duration_ms',
            description: 'HTTP request duration in milliseconds',
            type: 'histogram',
            labels: ['method', 'status'],
            buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
        });

        // Database metrics
        this.registerCustomMetric({
            name: 'database_query_duration_ms',
            description: 'Database query duration in milliseconds',
            type: 'histogram',
            buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
        });

        this.registerCustomMetric({
            name: 'database_connections_active',
            description: 'Active database connections',
            type: 'gauge',
        });

        // Application metrics
        this.registerCustomMetric({
            name: 'users_active_total',
            description: 'Total active users',
            type: 'gauge',
        });

        this.registerCustomMetric({
            name: 'credits_used_total',
            description: 'Total credits used',
            type: 'counter',
            labels: ['user_id', 'model'],
        });

        this.registerCustomMetric({
            name: 'ai_requests_total',
            description: 'Total AI requests',
            type: 'counter',
            labels: ['model', 'status'],
        });

        this.registerCustomMetric({
            name: 'ai_request_duration_ms',
            description: 'AI request duration in milliseconds',
            type: 'histogram',
            labels: ['model'],
            buckets: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000],
        });

        // System metrics
        this.registerCustomMetric({
            name: 'memory_usage_bytes',
            description: 'Memory usage in bytes',
            type: 'gauge',
        });

        this.registerCustomMetric({
            name: 'cpu_usage_percent',
            description: 'CPU usage percentage',
            type: 'gauge',
        });

        // Error metrics
        this.registerCustomMetric({
            name: 'errors_total',
            description: 'Total errors',
            type: 'counter',
            labels: ['type', 'severity'],
        });

        // Business metrics
        this.registerCustomMetric({
            name: 'payments_total',
            description: 'Total payments',
            type: 'counter',
            labels: ['status', 'package'],
        });

        this.registerCustomMetric({
            name: 'chats_created_total',
            description: 'Total chats created',
            type: 'counter',
            labels: ['user_type'],
        });
    }

    registerCustomMetric(metric: CustomMetric) {
        this.customMetrics.set(metric.name, metric);
        this.loggingService.logDebug(`Registered custom metric: ${metric.name}`, {
            metric: metric.name,
            type: metric.type,
        });
    }

    incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1) {
        const key = this.getMetricKey(name, labels);
        const existing = this.counters.get(key);

        if (existing) {
            existing.value += value;
        } else {
            this.counters.set(key, { value, labels });
        }

        this.recordMetric({
            name,
            type: 'counter',
            value,
            labels,
            timestamp: new Date(),
        });
    }

    recordGauge(name: string, value: number, labels: Record<string, string> = {}) {
        const key = this.getMetricKey(name, labels);
        this.gauges.set(key, { value, labels });

        this.recordMetric({
            name,
            type: 'gauge',
            value,
            labels,
            timestamp: new Date(),
        });
    }

    recordHistogram(name: string, value: number, labels: Record<string, string> = {}) {
        const key = this.getMetricKey(name, labels);
        const existing = this.histograms.get(key);

        if (existing) {
            existing.values.push(value);
            // Keep only recent values (last 1000)
            if (existing.values.length > 1000) {
                existing.values = existing.values.slice(-500);
            }
        } else {
            this.histograms.set(key, { values: [value], labels });
        }

        this.recordMetric({
            name,
            type: 'histogram',
            value,
            labels,
            timestamp: new Date(),
        });
    }

    // Business-specific metrics
    recordUserActivity(userId: string, activity: string) {
        this.incrementCounter('user_activity_total', {
            user_id: userId,
            activity,
        });
    }

    recordAIRequest(model: string, duration: number, success: boolean) {
        this.incrementCounter('ai_requests_total', {
            model,
            status: success ? 'success' : 'failed',
        });

        this.recordHistogram('ai_request_duration_ms', duration, { model });
    }

    recordCreditUsage(userId: string, model: string, amount: number) {
        this.incrementCounter('credits_used_total', {
            user_id: userId,
            model,
        }, amount);
    }

    recordPayment(packageId: string, amount: number, status: string) {
        this.incrementCounter('payments_total', {
            package: packageId,
            status,
        });

        this.recordGauge('payment_amount_latest', amount, {
            package: packageId,
        });
    }

    recordChatCreated(userType: string) {
        this.incrementCounter('chats_created_total', {
            user_type: userType,
        });
    }

    // Metric retrieval methods
    getCounterValue(name: string, labels: Record<string, string> = {}): number {
        const key = this.getMetricKey(name, labels);
        return this.counters.get(key)?.value || 0;
    }

    getGaugeValue(name: string, labels: Record<string, string> = {}): number {
        const key = this.getMetricKey(name, labels);
        return this.gauges.get(key)?.value || 0;
    }

    getHistogramStats(name: string, labels: Record<string, string> = {}): {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
    } | null {
        const key = this.getMetricKey(name, labels);
        const histogram = this.histograms.get(key);

        if (!histogram || histogram.values.length === 0) {
            return null;
        }

        const values = histogram.values.sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            sum,
            avg: sum / values.length,
            min: values[0],
            max: values[values.length - 1],
            p50: this.getPercentile(values, 0.5),
            p95: this.getPercentile(values, 0.95),
            p99: this.getPercentile(values, 0.99),
        };
    }

    getAllMetrics(): {
        counters: Array<{ name: string; value: number; labels: Record<string, string> }>;
        gauges: Array<{ name: string; value: number; labels: Record<string, string> }>;
        histograms: Array<{ name: string; stats: any; labels: Record<string, string> }>;
    } {
        const counters = Array.from(this.counters.entries()).map(([key, data]) => ({
            name: this.getMetricNameFromKey(key),
            value: data.value,
            labels: data.labels,
        }));

        const gauges = Array.from(this.gauges.entries()).map(([key, data]) => ({
            name: this.getMetricNameFromKey(key),
            value: data.value,
            labels: data.labels,
        }));

        const histograms = Array.from(this.histograms.entries()).map(([key, data]) => {
            const name = this.getMetricNameFromKey(key);
            const stats = this.getHistogramStats(name, data.labels);
            return {
                name,
                stats,
                labels: data.labels,
            };
        });

        return { counters, gauges, histograms };
    }

    // Export metrics in Prometheus format
    exportPrometheusMetrics(): string {
        const lines: string[] = [];

        // Add custom metric descriptions
        this.customMetrics.forEach((metric, name) => {
            lines.push(`# HELP ${name} ${metric.description}`);
            lines.push(`# TYPE ${name} ${metric.type}`);
        });

        // Export counters
        this.counters.forEach((data, key) => {
            const name = this.getMetricNameFromKey(key);
            const labels = this.formatPrometheusLabels(data.labels);
            lines.push(`${name}${labels} ${data.value}`);
        });

        // Export gauges
        this.gauges.forEach((data, key) => {
            const name = this.getMetricNameFromKey(key);
            const labels = this.formatPrometheusLabels(data.labels);
            lines.push(`${name}${labels} ${data.value}`);
        });

        // Export histograms
        this.histograms.forEach((data, key) => {
            const name = this.getMetricNameFromKey(key);
            const stats = this.getHistogramStats(name, data.labels);

            if (stats) {
                const labels = this.formatPrometheusLabels(data.labels);
                lines.push(`${name}_count${labels} ${stats.count}`);
                lines.push(`${name}_sum${labels} ${stats.sum}`);

                // Add buckets for histogram
                const metric = this.customMetrics.get(name);
                if (metric?.buckets) {
                    metric.buckets.forEach(bucket => {
                        const bucketCount = data.values.filter(v => v <= bucket).length;
                        const bucketLabels = this.formatPrometheusLabels({
                            ...data.labels,
                            le: bucket.toString(),
                        });
                        lines.push(`${name}_bucket${bucketLabels} ${bucketCount}`);
                    });
                }
            }
        });

        return lines.join('\n');
    }

    private recordMetric(metric: MetricData) {
        const key = metric.name;
        const existing = this.metrics.get(key) || [];
        existing.push(metric);

        // Keep only recent metrics (last 10000)
        if (existing.length > 10000) {
            this.metrics.set(key, existing.slice(-5000));
        } else {
            this.metrics.set(key, existing);
        }
    }

    private getMetricKey(name: string, labels: Record<string, string>): string {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return labelStr ? `${name}{${labelStr}}` : name;
    }

    private getMetricNameFromKey(key: string): string {
        return key.split('{')[0];
    }

    private formatPrometheusLabels(labels: Record<string, string>): string {
        if (Object.keys(labels).length === 0) return '';

        const labelPairs = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');

        return `{${labelPairs}}`;
    }

    private getPercentile(sortedValues: number[], percentile: number): number {
        if (sortedValues.length === 0) return 0;
        const index = Math.floor(sortedValues.length * percentile);
        return sortedValues[index] || 0;
    }

    private startMetricsCollection() {
        // Collect system metrics every 30 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);

        // Clean old metrics every hour
        setInterval(() => {
            this.cleanOldMetrics();
        }, 3600000);
    }

    private collectSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        this.recordGauge('memory_usage_bytes', memoryUsage.heapUsed);
        this.recordGauge('memory_total_bytes', memoryUsage.heapTotal);

        const cpuUsage = process.cpuUsage();
        this.recordGauge('cpu_usage_user_ms', cpuUsage.user / 1000);
        this.recordGauge('cpu_usage_system_ms', cpuUsage.system / 1000);
    }

    private cleanOldMetrics() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

        this.metrics.forEach((metrics, name) => {
            const filtered = metrics.filter(m => m.timestamp >= cutoff);
            this.metrics.set(name, filtered);
        });

        this.loggingService.logDebug('Cleaned old metrics', {
            totalMetricTypes: this.metrics.size,
        });
    }
}