import { supabase } from '../lib/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

// Supported languages and timezones
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;
export const SUPPORTED_TIMEZONES = ['UTC', 'EST', 'PST'] as const;

// Type definitions for supported values
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

export interface UserSettings {
  emailNotifications: boolean;
  projectUpdates: boolean;
  marketingEmails: boolean;
  language: SupportedLanguage;
  timezone: SupportedTimezone;
}

export interface SettingsError {
  field?: keyof UserSettings;
  message: string;
}

// Utility function to convert snake_case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Utility function to convert camelCase to snake_case
const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// Convert object keys from snake_case to camelCase
const convertToCamelCase = <T extends Record<string, any>>(obj: Record<string, any>): T => {
  return Object.entries(obj).reduce((acc: Record<string, any>, [key, value]) => {
    const camelKey = toCamelCase(key);
acc[camelKey] =
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? convertToCamelCase(value)
    : value;
    return acc;
  }, {}) as T;
};

// Convert object keys from camelCase to snake_case
const convertToSnakeCase = <T extends Record<string, any>>(obj: Record<string, any>): T => {
  return Object.entries(obj).reduce((acc: Record<string, any>, [key, value]) => {
    const snakeKey = toSnakeCase(key);
    acc[snakeKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? convertToSnakeCase(value)
      : value;
    return acc;
  }, {}) as T;
};

export const settingsService = {
  async getSettings(userId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Convert snake_case database fields to camelCase
      return convertToCamelCase<UserSettings>(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  },

  async updateSettings(userId: string, settings: Partial<UserSettings>): Promise<{ success: boolean; error?: SettingsError }> {
    try {
      const validationError = settingsService.validateSettings(settings);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Fetch existing settings
      const { data: existingSettings, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      // Convert camelCase fields to snake_case for database
      const snakeCaseSettings = convertToSnakeCase(settings);

      // Merge existing settings with new settings
      const mergedSettings = existingSettings
        ? { ...existingSettings, ...snakeCaseSettings }
        : { user_id: userId, ...snakeCaseSettings };

      // Perform update or insert based on whether settings exist
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          ...mergedSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return { success: true };
    } catch (error: unknown) {
      console.error('Error updating settings:', error);
      
      // Handle PostgrestError specifically
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const pgError = error as PostgrestError;
        return {
          success: false,
          error: {
            message: pgError.message || 'Database error occurred',
          },
        };
      }

      // Handle generic Error
      if (error instanceof Error) {
        return {
          success: false,
          error: {
            message: error.message || 'Failed to update settings',
          },
        };
      }

      // Handle unknown error types
      return {
        success: false,
        error: {
          message: 'An unexpected error occurred while updating settings',
        },
      };
    }
  },

  validateSettings(settings: Partial<UserSettings>): SettingsError | null {
    if (settings.language && !SUPPORTED_LANGUAGES.includes(settings.language as SupportedLanguage)) {
      return {
        field: 'language',
        message: `Invalid language selection. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
      };
    }

    if (settings.timezone && !SUPPORTED_TIMEZONES.includes(settings.timezone as SupportedTimezone)) {
      return {
        field: 'timezone',
        message: `Invalid timezone selection. Supported timezones: ${SUPPORTED_TIMEZONES.join(', ')}`,
      };
    }

    return null;
  },
}; 