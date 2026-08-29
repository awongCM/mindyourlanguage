export const DEFAULT_DEPLOY_HOOK_TIMEOUT_MS = 30_000

export interface TriggerRenderDeployOptions {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface TriggerRenderDeployResult {
  status: number
  deployId: string | null
}

export function parseRenderDeployHookUrl(value: string | undefined): string {
  const url = value?.trim()
  if (!url) {
    throw new Error('RENDER_DEPLOY_HOOK_URL is not set')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('RENDER_DEPLOY_HOOK_URL is not a valid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('RENDER_DEPLOY_HOOK_URL must use https')
  }

  const isRenderHook =
    parsed.hostname === 'api.render.com' &&
    parsed.pathname.startsWith('/deploy/')
  if (!isRenderHook) {
    throw new Error('RENDER_DEPLOY_HOOK_URL must be a Render deploy hook')
  }

  return url
}

export async function triggerRenderDeploy(
  options: TriggerRenderDeployOptions = {},
): Promise<TriggerRenderDeployResult> {
  const url = parseRenderDeployHookUrl(
    (options.env ?? process.env).RENDER_DEPLOY_HOOK_URL,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_DEPLOY_HOOK_TIMEOUT_MS

  const response = await fetchImpl(url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Render deploy hook failed: ${response.status}`)
  }

  let deployId: string | null = null
  if (response.status === 200) {
    try {
      const body = (await response.json()) as { deploy?: { id?: string } }
      deployId = body.deploy?.id ?? null
    } catch {
      deployId = null
    }
  }

  return { status: response.status, deployId }
}
