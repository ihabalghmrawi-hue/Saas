const { createClient } = require('../src/lib/redis/client')
const { DistributedScheduler } = require('../src/lib/redis/scheduler')
const { configureAllModules, useRedisModuleStores } = require('../src/lib/redis/configure')

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CRON_ID = `cron-${Math.random().toString(36).slice(2, 8)}`
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

async function main() {
  console.log(`[cron] Starting cron runner=${CRON_ID}`)

  const client = createClient({ url: REDIS_URL })
  client.on('error', (err) => console.error(`[cron] Redis error:`, err))
  await client.connect()
  console.log(`[cron] Connected to Redis`)

  const storeFactory = useRedisModuleStores(client, `finance:cron:${CRON_ID}:`)
  configureAllModules(storeFactory)

  const scheduler = new DistributedScheduler(client, {
    prefix: `finance:scheduler:`,
    workerId: CRON_ID,
  })
  await scheduler.start()

  const orphaned = await scheduler.recoverOrphanedJobs()
  console.log(`[cron] Recovered ${orphaned} orphaned jobs`)

  const isLeader = scheduler.isCurrentLeader()
  if (isLeader) {
    console.log(`[cron] This instance is the scheduler leader`)
  }

  process.on('SIGTERM', async () => {
    console.log(`[cron] Shutting down cron=${CRON_ID}`)
    await scheduler.stop()
    await client.quit()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log(`[cron] Interrupted cron=${CRON_ID}`)
    await scheduler.stop()
    await client.quit()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(`[cron] Fatal error:`, err)
  process.exit(1)
})
