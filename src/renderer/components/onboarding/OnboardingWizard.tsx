import { useState, useEffect } from 'react'
import { Key, BarChart3, CheckCircle2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useApiKey, useSettings } from '../../hooks/useSettings'
import { cn } from '../../lib/utils'
import {
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
  setAnalyticsOptIn
} from '../../services/analytics'

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)

  // Track onboarding started
  useEffect(() => {
    trackOnboardingStarted()
  }, [])
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [analyticsConsent, setAnalyticsConsent] = useState(false)
  const { setApiKey, isSettingKey } = useApiKey()
  const { updateSettings } = useSettings()

  const handleApiKeySave = async () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim())
      trackOnboardingStepCompleted('api_key')
      setStep(1)
    }
  }

  const handleComplete = async () => {
    // Update settings
    updateSettings({
      analyticsOptIn: analyticsConsent,
      onboardingComplete: true
    })

    // Enable/disable analytics based on consent
    setAnalyticsOptIn(analyticsConsent)

    // Track completion (will only send if opted in)
    trackOnboardingStepCompleted('analytics')
    trackOnboardingCompleted({
      analyticsOptIn: analyticsConsent,
      hasApiKey: !!apiKeyInput.trim()
    })

    onComplete()
  }

  const steps = [
    {
      icon: Key,
      title: 'API Key Setup',
      description: 'Connect to OpenRouter to enable AI capabilities'
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      description: 'Help us improve Open CoWork'
    }
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-medium" style={{ fontFamily: '"Space Mono", monospace' }}>Welcome to open co|work</h1>
          <p className="mt-2 text-muted-foreground">
            Let's get you set up in just a couple of steps
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-2 w-12 rounded-full transition-colors',
                index <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="rounded-lg border bg-card p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">OpenRouter API Key</h2>
                  <p className="text-sm text-muted-foreground">Required for AI features</p>
                </div>
              </div>

              <Input
                type="password"
                placeholder="sk-or-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />

              <p className="text-xs text-muted-foreground">
                Don't have an API key?{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get one from OpenRouter
                </a>
              </p>

              <Button
                className="w-full"
                onClick={handleApiKeySave}
                disabled={!apiKeyInput.trim() || isSettingKey}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Anonymous Analytics</h2>
                  <p className="text-sm text-muted-foreground">Optional and privacy-focused</p>
                </div>
              </div>

              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="mb-2">We collect:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Feature usage patterns</li>
                  <li>Error reports</li>
                  <li>Performance metrics</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  We never collect your code, API keys, or personal data.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">I agree to share anonymous usage data</span>
              </label>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleComplete}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
