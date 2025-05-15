import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Form schema
const apiKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  service: z.string().default('google-ai')
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export function ApiKeyManagement() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Define form with validation
  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: '',
      service: 'google-ai'
    }
  });

  // Define mutation for API key storage
  const apiKeyMutation = useMutation({
    mutationFn: (values: ApiKeyFormValues) => {
      return apiRequest(
        'POST',
        '/api/api-keys',
        {
          userId: 'default', // In a real app, this would be the actual user ID
          service: values.service,
          apiKey: values.apiKey
        }
      );
    },
    onSuccess: () => {
      setIsSuccess(true);
      setErrorMessage(null);
      // Reset form after successful submission
      form.reset({
        apiKey: '',
        service: 'google-ai'
      });
    },
    onError: (error: any) => {
      setIsSuccess(false);
      setErrorMessage(error.message || 'Failed to save API key');
    }
  });

  // Handle form submission
  const onSubmit = (values: ApiKeyFormValues) => {
    setIsSuccess(false);
    setErrorMessage(null);
    apiKeyMutation.mutate(values);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Google AI API Key</CardTitle>
        <CardDescription>
          Add your Google AI Studio API key to enable enhanced chapter detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>Your API key has been saved successfully.</AlertDescription>
          </Alert>
        )}
        
        {errorMessage && (
          <Alert className="mb-4 bg-red-50 text-red-800 border-red-200">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google AI API Key</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your API key..." 
                      {...field} 
                      type="password"
                    />
                  </FormControl>
                  <FormDescription>
                    Get your API key from <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={apiKeyMutation.isPending}
            >
              {apiKeyMutation.isPending ? 'Saving...' : 'Save API Key'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between flex-wrap text-sm text-gray-600">
        <p>Your API key is stored securely and never shared.</p>
      </CardFooter>
    </Card>
  );
}