import { generateText } from 'ai'
import { createOpenRouterClient } from './openrouter'

export async function parseFrequencyToCron(
  apiKey: string,
  frequencyText: string,
  timezone?: string | null
): Promise<{ cron: string; summary: string }> {
  const client = createOpenRouterClient(apiKey)
  const result = await generateText({
    model: client('google/gemini-3-flash-preview'),
    messages: [
      {
        role: 'user',
        content: `Convert this natural language schedule to a cron expression. Use a 5-field cron (minute hour day-of-month month day-of-week). If the schedule is unclear, make a reasonable assumption and summarize it. Return ONLY JSON with keys "cron" and "summary".\n\nSchedule: ${frequencyText}\nTimezone: ${timezone || 'local'}`
      }
    ],
    maxTokens: 200
  })

  const text = result.text.trim()
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const jsonText = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned
  const parsed = JSON.parse(jsonText) as { cron: string; summary: string }
  if (!parsed.cron) {
    throw new Error('Failed to parse cron expression')
  }

  return parsed
}

export function buildScheduleTitle(prompt: string) {
  const trimmed = prompt.trim()
  if (!trimmed) return 'Scheduled Task'
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed
}
