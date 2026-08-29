import { triggerRenderDeploy } from './render-deploy-hook'

async function main() {
  const result = await triggerRenderDeploy()
  const deployPart = result.deployId ? `; deploy id ${result.deployId}` : ''
  console.log(`Render deploy hook responded ${result.status}${deployPart}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
