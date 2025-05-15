import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react';

interface ApiKeyManagementProps {
  serviceName: string;
  serviceId: string;
  description: string;
  onKeyValidated?: (isValid: boolean) => void;
}

/**
 * Component for API key management
 * 
 * Allows users to enter and validate API keys for external services
 */
export function ApiKeyManagement({
  serviceName,
  serviceId,
  description,
  onKeyValidated,
}: ApiKeyManagementProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter an API key to validate.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsValidating(true);
      setValidationMessage('');
      
      // Send the API key to the server for validation
      const response = await apiRequest('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          service: serviceId,
          key: apiKey,
        }),
      });
      
      // Convert the response to the expected type
      const result = response as unknown as { 
        success: boolean; 
        message: string 
      };
      
      // Update validation state
      setIsValid(result.success);
      setValidationMessage(result.message);
      
      // Notify parent component of validation result
      if (onKeyValidated) {
        onKeyValidated(result.success);
      }
      
      // Show toast notification
      toast({
        title: result.success ? 'API Key Validated' : 'API Key Invalid',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('API key validation error:', error);
      
      setIsValid(false);
      setValidationMessage('An error occurred while validating the API key.');
      
      if (onKeyValidated) {
        onKeyValidated(false);
      }
      
      toast({
        title: 'Validation Error',
        description: 'Failed to validate API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="mr-2 h-5 w-5" />
          {serviceName} API Key
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${serviceId}-api-key`}>API Key</Label>
            <div className="flex space-x-2">
              <Input
                id={`${serviceId}-api-key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                type="password"
                className="flex-1"
                autoComplete="off"
              />
              <Button
                type="submit"
                disabled={isValidating || !apiKey.trim()}
                className="w-24 min-w-24"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
          </div>
        </form>
        
        {isValid !== null && (
          <div className={`mt-4 p-3 rounded-md ${
            isValid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <div className="flex items-center">
              {isValid ? (
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 mr-2 text-red-500" />
              )}
              <p className="text-sm">{validationMessage}</p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Your API key is securely stored and never shared with third parties.
      </CardFooter>
    </Card>
  );
}