// Define User interface locally to avoid circular dependencies
export interface User {
  id: string;
  email: string;
  password: string;
  creditsBalance: number;
  creditsReserved: number;
  isActive: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Auth Service
 * Defines the contract for authentication operations
 */
export interface IAuthService {
  /**
   * Validate user credentials
   * @param email - User's email
   * @param password - User's password
   * @returns Promise<User | null> - User if valid, null otherwise
   */
  validateUser(email: string, password: string): Promise<User | null>;

  /**
   * Generate JWT token
   * @param user - User object
   * @returns Promise<string> - JWT token
   */
  generateToken(user: User): Promise<string>;

  /**
   * Verify JWT token
   * @param token - JWT token
   * @returns Promise<any> - Decoded token payload
   */
  verifyToken(token: string): Promise<any>;

  /**
   * Hash password
   * @param password - Plain text password
   * @returns Promise<string> - Hashed password
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Compare password with hash
   * @param password - Plain text password
   * @param hash - Hashed password
   * @returns Promise<boolean> - Whether passwords match
   */
  comparePassword(password: string, hash: string): Promise<boolean>;

  /**
   * Create user account
   * @param email - User's email
   * @param password - User's password
   * @returns Promise<User> - Created user
   */
  createUser(email: string, password: string): Promise<User>;

  /**
   * Get user by email
   * @param email - User's email
   * @returns Promise<User | null> - User if found, null otherwise
   */
  getUserByEmail(email: string): Promise<User | null>;

  /**
   * Get user by ID
   * @param id - User's ID
   * @returns Promise<User | null> - User if found, null otherwise
   */
  getUserById(id: string): Promise<User | null>;
}
