import { Injectable, Logger } from '@nestjs/common';
import { ContainerConfig } from './kubernetes-config.service';

@Injectable()
export class DockerConfigService {
  private readonly logger = new Logger(DockerConfigService.name);

  async generateDockerCompose(config: ContainerConfig): Promise<string> {
    return 'version: "3.8"\nservices:\n  app:\n    image: test:latest';
  }

  async generateDockerfile(config: ContainerConfig): Promise<string> {
    return 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD ["npm", "start"]';
  }

  async generateDockerIgnore(): Promise<string> {
    return 'node_modules\n.env\n.git';
  }
}
