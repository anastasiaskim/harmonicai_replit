/**
 * Infrastructure Layer: Auth Service
 * Handles user authentication using Supabase Auth
 */
import { supabase, supabaseAdmin } from './supabaseClient';
import { AuthUser, AuthResponse } from '@shared/schema';

export class AuthService {
  /**
   * Sign up a new user
   */
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Create user record in the database
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email!,
          });

        if (dbError) {
          // Clean up the orphaned Auth user before throwing the error
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          throw dbError;
        }

        return {
          user: {
            id: data.user.id,
            email: data.user.email!,
          },
          error: null,
        };
      }

      return { user: null, error: new Error('Failed to create user') };
    } catch (error: any) {
      return {
        user: null,
        error: new Error(error.message || 'Failed to sign up'),
      };
    }
  }

  /**
   * Sign in an existing user
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        return {
          user: {
            id: data.user.id,
            email: data.user.email!,
          },
          error: null,
        };
      }

      return { user: null, error: new Error('Failed to sign in') };
    } catch (error: any) {
      return {
        user: null,
        error: new Error(error.message || 'Failed to sign in'),
      };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return {
        error: new Error(error.message || 'Failed to sign out'),
      };
    }
  }

  /**
   * Get the current user session
   */
  async getSession(): Promise<AuthResponse> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      if (session?.user) {
        return {
          user: {
            id: session.user.id,
            email: session.user.email!,
          },
          error: null,
        };
      }

      return { user: null, error: null };
    } catch (error: any) {
      return {
        user: null,
        error: new Error(error.message || 'Failed to get session'),
      };
    }
  }

  /**
   * Reset password for a user
   */
  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return {
        error: new Error(error.message || 'Failed to reset password'),
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(password: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return {
        error: new Error(error.message || 'Failed to update password'),
      };
    }
  }
}

export const authService = new AuthService(); 