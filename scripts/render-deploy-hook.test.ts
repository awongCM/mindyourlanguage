import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  parseRenderDeployHookUrl,
  triggerRenderDeploy,
} from './render-deploy-hook'

const VALID_HOOK =
  'https://api.render.com/deploy/srv-abc123?key=secret-hook-key'

describe('parseRenderDeployHookUrl', () => {
  it('accepts an official Render deploy hook URL', () => {
    assert.equal(parseRenderDeployHookUrl(VALID_HOOK), VALID_HOOK)
  })

  it('rejects a missing value', () => {
    assert.throws(
      () => parseRenderDeployHookUrl(undefined),
      /RENDER_DEPLOY_HOOK_URL is not set/,
    )
  })

  it('rejects a non-https URL', () => {
    assert.throws(
      () => parseRenderDeployHookUrl('http://api.render.com/deploy/srv-abc?key=k'),
      /must use https/,
    )
  })

  it('rejects a URL that is not a Render deploy hook', () => {
    assert.throws(
      () => parseRenderDeployHookUrl('https://example.com/deploy/srv-abc?key=k'),
      /must be a Render deploy hook/,
    )
  })

  it('rejects a hook URL that pins a git ref', () => {
    assert.throws(
      () => parseRenderDeployHookUrl(`${VALID_HOOK}&ref=main`),
      /must not include a ref parameter/,
    )
  })

  it('rejects a hook URL that overrides the image', () => {
    assert.throws(
      () => parseRenderDeployHookUrl(`${VALID_HOOK}&imgURL=docker.io%2Fnginx`),
      /must not include an imgURL parameter/,
    )
  })
})

describe('triggerRenderDeploy', () => {
  afterEach(() => {
    delete process.env.RENDER_DEPLOY_HOOK_URL
  })

  it('POSTs the hook URL and treats 200 as success', async () => {
    const calls: { url: string; method?: string }[] = []
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), method: String(init?.method ?? 'GET') })
      return new Response(JSON.stringify({ deploy: { id: 'dep-1' } }), {
        status: 200,
      })
    }

    const result = await triggerRenderDeploy({
      env: { RENDER_DEPLOY_HOOK_URL: VALID_HOOK },
      fetchImpl,
    })

    assert.equal(result.status, 200)
    assert.equal(result.deployId, 'dep-1')
    assert.deepEqual(calls, [{ url: VALID_HOOK, method: 'POST' }])
  })

  it('treats 202 accepted as success when a deploy is already running', async () => {
    const fetchImpl: typeof fetch = async () => new Response('', { status: 202 })
    const result = await triggerRenderDeploy({
      env: { RENDER_DEPLOY_HOOK_URL: VALID_HOOK },
      fetchImpl,
    })
    assert.equal(result.status, 202)
    assert.equal(result.deployId, null)
  })

  it('throws without including the secret URL when the hook rejects the request', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('nope', { status: 401 })
    await assert.rejects(
      () =>
        triggerRenderDeploy({
          env: { RENDER_DEPLOY_HOOK_URL: VALID_HOOK },
          fetchImpl,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /Render deploy hook failed: 401/)
        assert.equal(error.message.includes('secret-hook-key'), false)
        return true
      },
    )
  })
})
