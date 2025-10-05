import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';

export const seedUsers = async (dataSource: DataSource) => {
  const logger = new Logger('UserSeed');
  const userRepo = dataSource.getRepository(User);

  // Check if admin user already exists
  const existingUser = await userRepo.findOne({ where: { email: 'admin@genie.com' } });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = userRepo.create({
      email: 'admin@genie.com',
      password: hashedPassword,
      creditsBalance: 1000, // Start with 1000 credits
    });

    await userRepo.save(adminUser);
    logger.log('Admin user seeded');
  } else {
    logger.warn('Admin user already exists');
  }
};
