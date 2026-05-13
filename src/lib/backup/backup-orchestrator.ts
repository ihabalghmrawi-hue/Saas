import { createLogger } from '@/lib/observability/logger'
import { recordBackupOperation } from '@/lib/metrics/collector'

const logger = createLogger('backup-orchestrator')

export interface BackupPolicy {
  retentionDays: number
  dailyRetention: number
  weeklyRetention: number
  monthlyRetention: number
  schedule: 'daily' | 'hourly' | 'continuous'
  timezone: string
  includeTables: string[]
  excludeTables: string[]
  compression: 'gzip' | 'none'
  encryption: 'aes256' | 'none'
  encryptionKey?: string
}

export interface BackupJob {
  id: string
  type: 'full' | 'incremental' | 'snapshot'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  size?: number
  tableCounts?: Record<string, number>
  error?: string
  storagePath?: string
  checksum?: string
}

export interface BackupEntry {
  id: string
  companyId: string
  type: 'full' | 'incremental' | 'snapshot'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  size?: number
  storagePath: string
  checksum?: string
  retention: 'daily' | 'weekly' | 'monthly' | 'yearly'
  policy: string
}

let jobs = new Map<string, BackupJob>()

export function configureBackupStores(stores: { jobs?: Map<string, BackupJob> }): void {
  if (stores.jobs) jobs = stores.jobs
}

const DEFAULT_POLICY: BackupPolicy = {
  retentionDays: 30,
  dailyRetention: 7,
  weeklyRetention: 4,
  monthlyRetention: 12,
  schedule: 'daily',
  timezone: 'UTC',
  includeTables: [],
  excludeTables: [],
  compression: 'gzip',
  encryption: 'none',
}

export function createBackupPolicy(overrides: Partial<BackupPolicy>): BackupPolicy {
  return { ...DEFAULT_POLICY, ...overrides }
}

export async function executeBackup(
  companyId: string,
  type: BackupJob['type'],
  backupFn: (job: BackupJob) => Promise<{ storagePath: string; size: number; tableCounts: Record<string, number>; checksum: string }>,
  policy?: BackupPolicy,
): Promise<BackupJob> {
  const job: BackupJob = {
    id: `backup_${companyId}_${Date.now()}`,
    type,
    status: 'pending',
    startedAt: new Date().toISOString(),
  }

  jobs.set(job.id, job)

  try {
    job.status = 'running'
    const result = await backupFn(job)
    job.status = 'completed'
    job.completedAt = new Date().toISOString()
    job.size = result.size
    job.tableCounts = result.tableCounts
    job.storagePath = result.storagePath
    job.checksum = result.checksum
    recordBackupOperation('backup', 'success')
    logger.info(`Backup completed: ${job.id}`, { jobId: job.id, size: result.size, type })
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown backup error'
    recordBackupOperation('backup', 'failed')
    logger.error(`Backup failed: ${job.id}`, error instanceof Error ? error : undefined, { jobId: job.id })
  }

  return job
}

export async function enforceRetentionPolicy(
  listBackups: (companyId: string) => Promise<BackupEntry[]>,
  deleteBackup: (backupId: string) => Promise<void>,
  companyId: string,
  policy: BackupPolicy,
): Promise<{ deleted: number; kept: number }> {
  const backups = await listBackups(companyId)

  const sorted = backups.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const daily: BackupEntry[] = []
  const weekly: BackupEntry[] = []
  const monthly: BackupEntry[] = []
  const toDelete: BackupEntry[] = []

  for (const backup of sorted) {
    const age = Date.now() - new Date(backup.startedAt).getTime()
    const daysOld = age / 86400000

    if (daysOld > policy.retentionDays) {
      toDelete.push(backup)
      continue
    }

    const backupDate = new Date(backup.startedAt)
    const dateKey = backupDate.toISOString().slice(0, 10)
    const weekKey = `${backupDate.getFullYear()}-W${Math.ceil((backupDate.getDate() + 1 - backupDate.getDay()) / 7)}`
    const monthKey = `${backupDate.getFullYear()}-${backupDate.getMonth()}`

    if (daily.length < policy.dailyRetention && !daily.some(b => b.startedAt.slice(0, 10) === dateKey)) {
      daily.push(backup)
    } else if (weekly.length < policy.weeklyRetention && !weekly.some(b => b.startedAt.slice(0, 10).startsWith(weekKey.slice(0, 8)))) {
      weekly.push(backup)
    } else if (monthly.length < policy.monthlyRetention && !monthly.some(b => b.startedAt.slice(0, 7) === monthKey)) {
      monthly.push(backup)
    } else {
      toDelete.push(backup)
    }
  }

  for (const backup of toDelete) {
    try {
      await deleteBackup(backup.id)
      recordBackupOperation('retention_delete', 'success')
    } catch (error) {
      logger.error(`Failed to delete old backup: ${backup.id}`, error instanceof Error ? error : undefined)
      recordBackupOperation('retention_delete', 'failed')
    }
  }

  return { deleted: toDelete.length, kept: daily.length + weekly.length + monthly.length }
}

export async function verifyBackupIntegrity(
  backup: BackupEntry,
  verifyFn: (backup: BackupEntry) => Promise<{ valid: boolean; errors: string[]; checksum: string }>,
): Promise<{ valid: boolean; errors: string[]; checksum: string }> {
  const result = await verifyFn(backup)
  recordBackupOperation('verify', result.valid ? 'success' : 'failed')
  return result
}

export function getBackupJob(jobId: string): BackupJob | undefined {
  return jobs.get(jobId)
}

export function getRecentBackups(companyId?: string): BackupJob[] {
  return Array.from(jobs.values())
    .filter(j => !companyId || j.id.includes(companyId))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}
