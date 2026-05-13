const { createClient } = require('../src/lib/redis/client')
const { DistributedQueue } = require('../src/lib/redis/queue')
const { WorkerCoordinator } = require('../src/lib/redis/worker-coordinator')
const { EventBus } = require('../src/lib/redis/pubsub')
const { DistributedScheduler } = require('../src/lib/redis/scheduler')
const { MetricsAggregator } = require('../src/lib/redis/metrics-aggregator')
const { configureAllModules, useRedisModuleStores } = require('../src/lib/redis/configure')

const WORKER_TYPE = process.env.WORKER_TYPE || 'default'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const WORKER_ID = `${WORKER_TYPE}-${Math.random().toString(36).slice(2, 8)}`
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

async function main() {
  console.log(`[worker] Starting worker=${WORKER_ID} type=${WORKER_TYPE}`)

  const client = createClient({ url: REDIS_URL })
  client.on('error', (err) => console.error(`[worker] Redis error:`, err))
  await client.connect()
  console.log(`[worker] Connected to Redis`)

  const storeFactory = useRedisModuleStores(client, `finance:worker:${WORKER_ID}:`)
  configureAllModules(storeFactory)

  const coordinator = new WorkerCoordinator(client, {
    prefix: `finance:workers:`,
    workerId: WORKER_ID,
  })

  await coordinator.register(WORKER_TYPE, { workerType: WORKER_TYPE })

  const bus = new EventBus(client)
  await bus.subscribe(`worker:${WORKER_TYPE}`, async (message) => {
    console.log(`[worker] Received event:`, message)
  })

  const scheduler = new DistributedScheduler(client, {
    prefix: `finance:scheduler:`,
    workerId: WORKER_ID,
  })
  await scheduler.start()

  const aggregator = new MetricsAggregator(client, { prefix: `finance:metrics:${WORKER_ID}:` })
  aggregator.start()

  const queues = {
    accounting: new DistributedQueue(client, { queueKey: `finance:queue:accounting` }),
    reconciliation: new DistributedQueue(client, { queueKey: `finance:queue:reconciliation` }),
    recurring: new DistributedQueue(client, { queueKey: `finance:queue:recurring` }),
    backup: new DistributedQueue(client, { queueKey: `finance:queue:backup` }),
  }

  const assignedQueue = queues[WORKER_TYPE]
  if (assignedQueue) {
    processQueue(assignedQueue, WORKER_TYPE, aggregator)
  } else {
    for (const [name, q] of Object.entries(queues)) {
      processQueue(q, name, aggregator)
    }
  }

  process.on('SIGTERM', async () => {
    console.log(`[worker] Shutting down worker=${WORKER_ID}`)
    scheduler.stop()
    aggregator.stop()
    await coordinator.unregister()
    await client.quit()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log(`[worker] Interrupted worker=${WORKER_ID}`)
    scheduler.stop()
    aggregator.stop()
    await coordinator.unregister()
    await client.quit()
    process.exit(0)
  })

  setInterval(async () => {
    try {
      await coordinator.heartbeat()
    } catch (err) {
      console.error(`[worker] Heartbeat failed:`, err)
    }
  }, 5000)
}

function processQueue(queue, name, aggregator) {
  setInterval(async () => {
    try {
      const message = await queue.dequeue(1)
      if (message) {
        const start = Date.now()
        try {
          console.log(`[worker] Processing ${name} job: ${message.id || 'unknown'}`)
          await aggregator.record('queue.throughput', 1, { queue: name })
          await queue.ack(message.id)
          await aggregator.record('queue.processed', Date.now() - start, { queue: name, status: 'success' })
        } catch (err) {
          await queue.nack(message.id)
          await aggregator.record('queue.processed', Date.now() - start, { queue: name, status: 'failed' })
          console.error(`[worker] Failed to process ${name} job:`, err)
        }
      }
    } catch (err) {
      if (err.code !== 'BRPOPLPUSH_TIMEOUT') {
        console.error(`[worker] Queue error for ${name}:`, err)
      }
    }
  }, 1000)
}

main().catch((err) => {
  console.error(`[worker] Fatal error:`, err)
  process.exit(1)
})
