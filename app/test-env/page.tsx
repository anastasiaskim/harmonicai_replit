'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message?: string;
}

export default function TestEnv() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const router = useRouter()

  const runTests = async () => {
    const results: TestResult[] = []
    
    // Test 1: Authentication
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      results.push({
        name: 'Authentication',
        status: authError ? 'error' : session ? 'success' : 'error',
        message: authError ? authError.message : session ? 'Authenticated' : 'No session found'
      })
    } catch (err) {
      results.push({
        name: 'Authentication',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }

    // Test 2: Database Connection
    try {
      const { data, error: dbError } = await supabase
        .from('health_check')
        .select('status')
        .limit(1)
      
      results.push({
        name: 'Database Connection',
        status: dbError ? 'error' : 'success',
        message: dbError ? dbError.message : 'Connected successfully'
      })
    } catch (err) {
      results.push({
        name: 'Database Connection',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }

    // Test 3: Storage Access
    try {
      const { data, error: storageError } = await supabase
        .storage
        .from('audio')
        .list()
      
      results.push({
        name: 'Storage Access',
        status: storageError ? 'error' : 'success',
        message: storageError ? storageError.message : 'Access granted'
      })
    } catch (err) {
      results.push({
        name: 'Storage Access',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }

    setTestResults(results)
    setLoading(false)
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          throw error
        }

        if (!session) {
         setLoading(false) // Stop loading before redirect
          try {
            router.push('/login')
          } catch (navError) {
            console.error('Navigation error:', navError)
            setError('Failed to redirect to login page')
          }
          return
        }

        await runTests()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Environment</h1>
      <div className="space-y-4">
        <div className="p-4 border rounded bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-3">
            {testResults.map((test, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-medium">{test.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    test.status === 'success' ? 'bg-green-100 text-green-800' :
                    test.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {test.status}
                  </span>
                  {test.message && (
                    <span className="text-sm text-gray-600">{test.message}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button
          onClick={runTests}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Run Tests Again
        </button>
      </div>
    </div>
  )
} 