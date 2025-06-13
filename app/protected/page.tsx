import { createClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      redirect('/auth')
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-3xl font-bold text-center">
              Protected Page
            </h2>
            <p className="mt-2 text-center text-gray-600">
              You are signed in as {session.user?.email || 'a user'}
            </p>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error fetching session:', error)
    // Optionally redirect to an error page or handle the error in another way
    redirect('/error')
  }
} 