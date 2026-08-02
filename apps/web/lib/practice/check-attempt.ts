import type {
  CheckAttemptRequest,
  CheckAttemptResponse,
  CheckAttemptVerdict,
} from '@mindyourlanguage/shared'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_CHECK_MODEL = 'gpt-5.6-luna'
const CHECK_FETCH_TIMEOUT_MS = 10_000

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

const VALID_VERDICTS: CheckAttemptVerdict[] = ['close', 'partial', 'off']

export function isCheckAttemptAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function parseCheckAttemptResponse(
  content: string,
): CheckAttemptResponse | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const data = parsed as Record<string, unknown>

  if (
    typeof data.verdict !== 'string' ||
    !VALID_VERDICTS.includes(data.verdict as CheckAttemptVerdict) ||
    typeof data.feedback !== 'string' ||
    !data.feedback.trim()
  ) {
    return null
  }

  const corrections = Array.isArray(data.corrections)
    ? data.corrections.filter(
        (item): item is string => typeof item === 'string' && Boolean(item.trim()),
      )
    : undefined

  return {
    verdict: data.verdict as CheckAttemptVerdict,
    feedback: data.feedback.trim(),
    ...(corrections && corrections.length > 0 ? { corrections } : {}),
    ...(typeof data.betterPhrasing === 'string' && data.betterPhrasing.trim()
      ? { betterPhrasing: data.betterPhrasing.trim() }
      : {}),
  }
}

export async function checkUserAttempt(
  request: CheckAttemptRequest,
): Promise<CheckAttemptResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CHECK_FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.PRACTICE_CHECK_MODEL || DEFAULT_CHECK_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Compare a learner Mandarin attempt to model translations. ' +
              'Return JSON exactly shaped as { "verdict": "close" | "partial" | "off", "feedback": string, "corrections"?: string[], "betterPhrasing"?: string }. ' +
              'Be concise and actionable for an intermediate learner.',
          },
          {
            role: 'user',
            content:
              `English source:\n${request.sourceText}\n\n` +
              `Learner attempt:\n${request.userAttempt}\n\n` +
              `Primary translation:\n${request.primaryTranslation}\n\n` +
              `Native alternative:\n${request.nativeAlternative ?? '(none)'}`,
          },
        ],
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as OpenAIChatCompletionResponse
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    return parseCheckAttemptResponse(content)
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
