import { supabaseAdmin } from './supabaseClient';
import { User, UsageLog, SUBSCRIPTION_TIERS } from '@shared/schema';

export class UserService {
  private static instance: UserService;

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async createUser(authUser: { id: string; email: string }): Promise<User> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        subscriptionTier: 'free',
        usageQuota: SUBSCRIPTION_TIERS.FREE.characterLimit,
        usageCount: 0,
        lastUsageReset: now,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async logUsage(userId: string, action: string, characterCount: number = 0, fileSize: number = 0, metadata: any = {}): Promise<void> {
    // Validate numeric parameters
    if (characterCount < 0) {
      throw new Error('Character count cannot be negative');
    }
    if (fileSize < 0) {
      throw new Error('File size cannot be negative');
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('usage_logs')
      .insert({
        userId,
        action,
        characterCount,
        fileSize,
        metadata,
        createdAt: now,
      });

    if (error) throw error;

    // Update user's usage count
    await this.updateUserUsage(userId, characterCount);
  }

  private async updateUserUsage(userId: string, characterCount: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    // Check if we need to reset the usage count (new month)
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    const needsReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        usageCount: needsReset ? characterCount : user.usageCount + characterCount,
        lastUsageReset: needsReset ? now.toISOString() : user.lastUsageReset,
        updatedAt: now.toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  }

  async checkUsageLimit(userId: string, requiredCharacters: number): Promise<{ allowed: boolean; message?: string }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const tier = SUBSCRIPTION_TIERS[user.subscriptionTier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
    if (!tier) throw new Error('Invalid subscription tier');

    // Check if user has exceeded their monthly limit
    if (user.usageCount + requiredCharacters > tier.characterLimit) {
      return {
        allowed: false,
        message: `You have exceeded your monthly character limit. Please upgrade your subscription or wait until next month.`,
      };
    }

    return { allowed: true };
  }

  async upgradeSubscription(userId: string, newTier: keyof typeof SUBSCRIPTION_TIERS): Promise<User> {
    const tier = SUBSCRIPTION_TIERS[newTier];
    if (!tier) throw new Error('Invalid subscription tier');

    return this.updateUser(userId, {
      subscriptionTier: tier.name,
      usageQuota: tier.characterLimit,
    });
  }
}

export const userService = UserService.getInstance(); 