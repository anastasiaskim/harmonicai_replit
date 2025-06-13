import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import Settings from '@/pages/Settings';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { settingsService } from '@/services/settingsService';
import { Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import type { User, Session, Subscription } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }))
    }
  }
}));

// Mock the settings service
vi.mock('@/services/settingsService', () => ({
  settingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    validateSettings: vi.fn(),
  },
}));

// Mock user data
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {
    subscriptionTier: 'FREE',
    characterLimit: 1000,
    charactersUsed: 0
  },
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString()
};

const mockPremiumUser: User = {
  id: 'premium-user-id',
  email: 'premium@example.com',
  app_metadata: {
    subscriptionTier: 'PREMIUM',
    characterLimit: 10000,
    charactersUsed: 5000
  },
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString()
};

describe('Settings Page', () => {
  let authSubscription: Subscription;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock initial session with complete Session object
    const mockSession: Session = {
      user: mockUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: 'bearer'
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: mockSession
      },
      error: null
    });

    // Mock auth state change subscription
    authSubscription = {
      id: 'mock-subscription-id',
      callback: vi.fn(),
      unsubscribe: vi.fn()
    };
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: authSubscription }
    });
  });

  afterEach(() => {
    // Cleanup auth subscription
    if (authSubscription) {
      authSubscription.unsubscribe();
    }
  });

  const renderSettings = () => {
    return render(
      <UserProvider>
        {/* Known issue with react-hot-toast types */}
        <Toaster />
        <Settings />
      </UserProvider>
    );
  };

  it('loads and displays settings for free user', async () => {
    const mockSettings = {
      emailNotifications: true,
      projectUpdates: false,
      marketingEmails: true,
      language: 'en',
      timezone: 'UTC',
    };

    vi.mocked(settingsService.getSettings).mockResolvedValue(mockSettings);
    renderSettings();

    // Check loading state
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Verify user context
    const { result } = renderHook(() => useUser());
    expect(result.current.user?.id).toBe(mockUser.id);
    expect(result.current.user?.app_metadata.subscriptionTier).toBe('FREE');

    // Verify settings are displayed
    expect(screen.getByLabelText('Receive email notifications')).toBeChecked();
    expect(screen.getByLabelText('Receive project updates')).not.toBeChecked();
    expect(screen.getByLabelText('Receive marketing emails')).toBeChecked();
    expect(screen.getByDisplayValue('en')).toBeInTheDocument();
    expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
  });

  it('loads and displays settings for premium user', async () => {
    // Mock premium user session
    const mockPremiumSession: Session = {
      user: mockPremiumUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: 'bearer'
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: mockPremiumSession
      },
      error: null
    });

    const mockSettings = {
      emailNotifications: true,
      projectUpdates: true,
      marketingEmails: false,
      language: 'fr',
      timezone: 'EST',
    };

    vi.mocked(settingsService.getSettings).mockResolvedValue(mockSettings);
    renderSettings();

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Verify user context
    const { result } = renderHook(() => useUser());
    expect(result.current.user?.id).toBe(mockPremiumUser.id);
    expect(result.current.user?.app_metadata.subscriptionTier).toBe('PREMIUM');

    // Verify premium features are available
    expect(screen.getByText('Premium Features')).toBeInTheDocument();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
  });

  it('handles settings update', async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      emailNotifications: true,
      projectUpdates: true,
      marketingEmails: false,
      language: 'en',
      timezone: 'UTC',
    });

    vi.mocked(settingsService.updateSettings).mockResolvedValue({ success: true });

    renderSettings();

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Toggle a setting
    fireEvent.click(screen.getByLabelText('Receive email notifications'));

    // Save changes
    fireEvent.click(screen.getByText('Save changes'));

    // Verify update was called with correct user ID
    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          emailNotifications: false,
        })
      );
    });

    // Verify success message
    expect(screen.getByText('Settings updated successfully')).toBeInTheDocument();
  });

  it('handles validation errors', async () => {
    // Mock initial settings
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      emailNotifications: true,
      projectUpdates: true,
      marketingEmails: false,
      language: 'en',
      timezone: 'UTC',
    });

    // Mock validation error
    vi.mocked(settingsService.validateSettings).mockReturnValue({
      field: 'language',
      message: 'Invalid language selection',
    });

    renderSettings();

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Change language to invalid value
    const languageInput = screen.getByDisplayValue('en');
    fireEvent.change(languageInput, { target: { value: 'invalid' } });

    // Save changes
    const saveButton = screen.getByText('Save changes');
    fireEvent.click(saveButton);

    // Wait for and verify error message
    await waitFor(() => {
      expect(screen.getByText('Invalid language selection')).toBeInTheDocument();
    });

    // Verify validation was called
    expect(settingsService.validateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'invalid',
      })
    );

    // Verify update was not called
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      emailNotifications: true,
      projectUpdates: true,
      marketingEmails: false,
      language: 'en',
      timezone: 'UTC',
    });

    vi.mocked(settingsService.updateSettings).mockResolvedValue({
      success: false,
      error: { message: 'Failed to update settings' },
    });

    renderSettings();

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Toggle a setting
    fireEvent.click(screen.getByLabelText('Receive email notifications'));

    // Save changes
    fireEvent.click(screen.getByText('Save changes'));

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText('Failed to update settings')).toBeInTheDocument();
    });
  });

  it('handles auth state changes', async () => {
    renderSettings();

    // Initial state
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Simulate auth state change to premium user
    const authStateChangeCallback = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    authStateChangeCallback('SIGNED_IN', {
      user: mockPremiumUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: 'bearer'
    } as Session);

    // Verify premium features appear
    await waitFor(() => {
      expect(screen.getByText('Premium Features')).toBeInTheDocument();
    });
  });
}); 