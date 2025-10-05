import { IAuthService, User } from '../../interfaces/services';

/**
 * Mock implementation of IAuthService for testing
 */
export class MockAuthService implements IAuthService {
  private mockUsers: User[] = [];
  private nextId = 1;

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = this.mockUsers.find(u => u.email === email);
    if (!user) {
      return null;
    }

    // In a real implementation, this would verify the password hash
    // For testing, we'll use a simple comparison
    if (password === 'validpassword') {
      return user;
    }
    return null;
  }

  async generateToken(user: User): Promise<string> {
    // Mock JWT token
    return `mock_jwt_token_${user.id}_${Date.now()}`;
  }

  async verifyToken(token: string): Promise<any> {
    // Mock token verification
    if (token.startsWith('mock_jwt_token_')) {
      const parts = token.split('_');
      const userId = parts[3];
      const user = this.mockUsers.find(u => u.id === userId);
      if (user) {
        return {
          sub: user.id,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        };
      }
    }
    throw new Error('Invalid token');
  }

  async hashPassword(password: string): Promise<string> {
    // Mock password hashing - in real implementation, this would use bcrypt
    return `hashed_${password}`;
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    // Mock password comparison
    return hash === `hashed_${password}`;
  }

  async createUser(email: string, password: string): Promise<User> {
    const existingUser = this.mockUsers.find(u => u.email === email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user: User = {
      id: `user_${this.nextId++}`,
      email,
      password: await this.hashPassword(password),
      creditsBalance: 10, // Welcome credits
      creditsReserved: 0,
      isActive: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mockUsers.push(user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.mockUsers.find(u => u.email === email) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.mockUsers.find(u => u.id === id) || null;
  }

  // Test helpers
  addMockUser(user: User): void {
    this.mockUsers.push(user);
  }

  getMockUsers(): User[] {
    return [...this.mockUsers];
  }

  clearMockData(): void {
    this.mockUsers = [];
    this.nextId = 1;
  }

  setMockUserPassword(userId: string, password: string): void {
    const user = this.mockUsers.find(u => u.id === userId);
    if (user) {
      user.password = `hashed_${password}`;
    }
  }
}
