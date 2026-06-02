import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Life Tracker</h1>
          <p className="text-muted-foreground mt-2">Your personal health & productivity dashboard</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(217.2, 91.2%, 59.8%)',
                    brandAccent: 'hsl(217.2, 91.2%, 50%)',
                    inputBackground: 'hsl(222.2, 84%, 6.5%)',
                    inputBorder: 'hsl(217.2, 32.6%, 17.5%)',
                    inputText: 'hsl(210, 40%, 98%)',
                    inputPlaceholder: 'hsl(215, 20.2%, 45%)',
                    defaultButtonBackground: 'hsl(217.2, 32.6%, 17.5%)',
                    defaultButtonBackgroundHover: 'hsl(217.2, 32.6%, 22%)',
                    defaultButtonBorder: 'hsl(217.2, 32.6%, 17.5%)',
                    defaultButtonText: 'hsl(210, 40%, 98%)',
                    dividerBackground: 'hsl(217.2, 32.6%, 17.5%)',
                    messageText: 'hsl(210, 40%, 98%)',
                    anchorTextColor: 'hsl(217.2, 91.2%, 59.8%)',
                    anchorTextHoverColor: 'hsl(217.2, 91.2%, 70%)',
                  },
                },
              },
            }}
            providers={[]}
          />
        </div>
      </div>
    </div>
  )
}
