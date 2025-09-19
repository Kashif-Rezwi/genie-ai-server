import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');
    app.enableCors();

    // Enable global validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    app.useGlobalFilters(new AllExceptionsFilter());

    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Genie API running on port ${port}`);
}
bootstrap();