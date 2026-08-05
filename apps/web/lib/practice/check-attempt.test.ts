import { describe, expect, it } from 'vitest'
import { parseCheckAttemptResponse } from './check-attempt'

describe('parseCheckAttemptResponse', () => {
  it('parses a valid check response', () => {
    const parsed = parseCheckAttemptResponse(
      JSON.stringify({
        verdict: 'partial',
        feedback: 'Word order is off.',
        corrections: ['Use 吗 for yes/no questions'],
        betterPhrasing: '你好吗？',
      }),
    )

    expect(parsed).toEqual({
      verdict: 'partial',
      feedback: 'Word order is off.',
      corrections: ['Use 吗 for yes/no questions'],
      betterPhrasing: '你好吗？',
    })
  })

  it('rejects invalid verdicts and empty feedback', () => {
    expect(
      parseCheckAttemptResponse(
        JSON.stringify({ verdict: 'great', feedback: 'Nice' }),
      ),
    ).toBeNull()
    expect(
      parseCheckAttemptResponse(
        JSON.stringify({ verdict: 'close', feedback: '   ' }),
      ),
    ).toBeNull()
    expect(parseCheckAttemptResponse('not-json')).toBeNull()
  })
})
