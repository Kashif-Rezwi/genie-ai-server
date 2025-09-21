const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testCron() {
    const app = await NestFactory.create(AppModule);

    // Get the analytics service
    const analyticsService = app.get('AnalyticsJobService');
    const maintenanceService = app.get('MaintenanceJobService');

    console.log('Testing cron services...');

    try {
        // Test analytics
        await analyticsService.scheduleDailyAnalytics();
        console.log('✅ Daily analytics scheduled');

        // Test maintenance
        await maintenanceService.scheduleDataCleanup();
        console.log('✅ Data cleanup scheduled');

    } catch (error) {
        console.error('❌ Cron test failed:', error);
    }

    await app.close();
}

testCron();