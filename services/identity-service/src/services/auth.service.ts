import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { CredentialRepository } from '../repositories/credential.repository';
import { SessionRepository } from '../repositories/session.repository';
import { EventPublisher } from '../events/event-publisher';
import { createEvent, UserRegisteredEventSchema, UserLoggedInEventSchema, UserLoggedOutEventSchema } from '@microservice-learning/events';
import { LoginInput, TokenPair } from '../types/user.types';
import { getCorrelationId } from '@microservice-learning/observability';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private credentialRepository: CredentialRepository,
    private sessionRepository: SessionRepository,
    private eventPublisher: EventPublisher
  ) {}

  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    correlationId?: string
  ): Promise<{ user: any; tokens: TokenPair }> {
    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = await this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
    });

    // Create credentials
    await this.credentialRepository.create(user.id, password);

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.sessionRepository.create(
      user.id,
      tokens.refreshToken,
      expiresAt
    );

    // Publish event
    const event = createEvent(
      'UserRegistered',
      'v1',
      {
        userId: user.id,
        email: user.email,
        registeredAt: user.createdAt.toISOString(),
      },
      {
        source: 'identity-service',
        correlationId: correlationId || getCorrelationId(),
        userId: user.id,
      }
    );

    await this.eventPublisher.publish('identity.user.registered', event);

    return { user, tokens };
  }

  async login(input: LoginInput, correlationId?: string): Promise<{ user: any; tokens: TokenPair }> {
    // Find user
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await this.credentialRepository.verifyPassword(
      user.id,
      input.password
    );
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    const session = await this.sessionRepository.create(
      user.id,
      tokens.refreshToken,
      expiresAt,
      input.ipAddress,
      input.userAgent
    );

    // Publish event
    const event = createEvent(
      'UserLoggedIn',
      'v1',
      {
        userId: user.id,
        sessionId: session.id,
        loginAt: new Date().toISOString(),
        ipAddress: input.ipAddress,
      },
      {
        source: 'identity-service',
        correlationId: correlationId || getCorrelationId(),
        userId: user.id,
      }
    );

    await this.eventPublisher.publish('identity.user.logged-in', event);

    return { user, tokens };
  }

  async logout(sessionId: string, userId: string, correlationId?: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);

    // Publish event
    const event = createEvent(
      'UserLoggedOut',
      'v1',
      {
        userId,
        sessionId,
        logoutAt: new Date().toISOString(),
      },
      {
        source: 'identity-service',
        correlationId: correlationId || getCorrelationId(),
        userId,
      }
    );

    await this.eventPublisher.publish('identity.user.logged-out', event);
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const session = await this.sessionRepository.findByRefreshToken(refreshToken);
    if (!session) {
      throw new Error('Invalid refresh token');
    }

    // Update last accessed
    await this.sessionRepository.updateLastAccessed(session.id);

    // Generate new tokens
    return this.generateTokens(session.userId);
  }

  async validateToken(token: string): Promise<{ userId: string } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  private async generateTokens(userId: string): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );

    const refreshToken = randomUUID();
    
    // Calculate expires in seconds
    const expiresIn = this.parseExpiry(JWT_ACCESS_EXPIRY);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}
