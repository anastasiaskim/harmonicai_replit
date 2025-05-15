import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyManagementProps {
  service: string;
  serviceName: string;
  description: string;
  onKeyValidated?: (isValid: boolean) => void;
}

export function ApiKeyManagement({ 
  service, 
  serviceName, 
  description,
  onKeyValidated 
}: ApiKeyManagementProps) {
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();
  
  // Mutation for validating and saving API key
  const validateKeyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          service,
          key: apiKey
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      
      // Show success message
      toast({
        title: data.success ? "API Key Validated" : "API Key Invalid",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      
      // Call the callback if provided
      if (onKeyValidated) {
        onKeyValidated(data.success);
      }
    },
    onError: (error) => {
      console.error('Error validating API key:', error);
      toast({
        title: "Validation Failed",
        description: error instanceof Error ? error.message : "Failed to validate API key",
        variant: "destructive",
      });
      
      // Call the callback with false if provided
      if (onKeyValidated) {
        onKeyValidated(false);
      }
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: `Please enter your ${serviceName} API key`,
        variant: "destructive",
      });
      return;
    }
    
    validateKeyMutation.mutate();
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {serviceName} API Key
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${service}-api-key`}>API Key</Label>
            <Input
              id={`${service}-api-key`}
              type="password"
              placeholder={`Enter your ${serviceName} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
            />
          </div>
          
          {validateKeyMutation.isPending && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Validating...</AlertTitle>
              <AlertDescription>
                Validating your API key with {serviceName}
              </AlertDescription>
            </Alert>
          )}
          
          {validateKeyMutation.isSuccess && validateKeyMutation.data && (
            <>
              {(validateKeyMutation.data as any).success ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>API Key Valid</AlertTitle>
                  <AlertDescription>
                    Your {serviceName} API key has been validated and saved
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>API Key Invalid</AlertTitle>
                  <AlertDescription>
                    {(validateKeyMutation.data as any).message}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
          
          {validateKeyMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>
                {validateKeyMutation.error instanceof Error 
                  ? validateKeyMutation.error.message 
                  : "Failed to validate API key"
                }
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          type="submit" 
          onClick={handleSubmit}
          disabled={validateKeyMutation.isPending || !apiKey.trim()}
          className="w-full"
        >
          {validateKeyMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Validate and Save API Key
        </Button>
      </CardFooter>
    </Card>
  );
}