import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { settingsService, UserSettings, SettingsError } from '@/services/settingsService';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<SettingsError | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    projectUpdates: true,
    marketingEmails: false,
    language: 'en',
    timezone: 'UTC',
  });

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    loadSettings();
  }, [user?.id]);

const loadSettings = async () => {
   if (!user?.id) return;
    setIsLoading(true);
    try {
     const userSettings = await settingsService.getSettings(user.id);
      if (userSettings) {
        setSettings(userSettings);
      }
    } catch (error) {
      toast.error('Failed to load settings');
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof UserSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setError(null);
  };

  const handleSelectChange = (key: keyof UserSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setError(null);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    // Validate settings
    const validationError = settingsService.validateSettings(settings);
    if (validationError) {
      setError(validationError);
      toast.error(validationError.message);
      return;
    }

    setIsSaving(true);
    try {
      const result = await settingsService.updateSettings(user.id, settings);
      if (result.success) {
        toast.success('Settings updated successfully');
        setError(null);
      } else {
        setError(result.error || null);
        toast.error(result.error?.message || 'Failed to update settings');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Main Content */}
        <div className="mt-8">
          {/* Notification Settings */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Notification Preferences
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage how you receive notifications
              </p>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Email Notifications
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={() => handleNotificationChange('emailNotifications')}
                        className="form-checkbox h-4 w-4 text-blue-600"
                        disabled={isSaving}
                      />
                      <span className="ml-2">Receive email notifications</span>
                    </label>
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Project Updates
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.projectUpdates}
                        onChange={() => handleNotificationChange('projectUpdates')}
                        className="form-checkbox h-4 w-4 text-blue-600"
                        disabled={isSaving}
                      />
                      <span className="ml-2">Receive project updates</span>
                    </label>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Marketing Emails
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.marketingEmails}
                        onChange={() => handleNotificationChange('marketingEmails')}
                        className="form-checkbox h-4 w-4 text-blue-600"
                        disabled={isSaving}
                      />
                      <span className="ml-2">Receive marketing emails</span>
                    </label>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Account Settings */}
          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Account Settings
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage your account preferences
              </p>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Language
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <select
                      value={settings.language}
                      onChange={(e) => handleSelectChange('language', e.target.value)}
                      className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                        error?.field === 'language' ? 'border-red-300' : ''
                      }`}
                      disabled={isSaving}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                    {error?.field === 'language' && (
                      <p className="mt-2 text-sm text-red-600">{error.message}</p>
                    )}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Time Zone
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <select
                      value={settings.timezone}
                      onChange={(e) => handleSelectChange('timezone', e.target.value)}
                      className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                        error?.field === 'timezone' ? 'border-red-300' : ''
                      }`}
                      disabled={isSaving}
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">Eastern Time</option>
                      <option value="PST">Pacific Time</option>
                    </select>
                    {error?.field === 'timezone' && (
                      <p className="mt-2 text-sm text-red-600">{error.message}</p>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 