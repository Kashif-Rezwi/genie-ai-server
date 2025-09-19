import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.enableCors();

    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Genie API running on port ${port}`);
}
bootstrap();