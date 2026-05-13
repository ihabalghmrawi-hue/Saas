import { getCorrelationId, getCausationId } from './correlation'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  correlationId: string
  causationId?: string
  message: string
  data?: unknown
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
  duration?: number
  tenantId?: string
  userId?: string
  resource?: string
  action?: string
  result?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function buildEntry(level: LogLevel, service: string, message: string, meta?: Partial<LogEntry>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    correlationId: getCorrelationId(),
    causationId: getCausationId() || undefined,
    message,
    ...meta,
  }
}

function write(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return

  const line = JSON.stringify(entry)

  switch (entry.level) {
    case 'error':
    case 'fatal':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    case 'debug':
      console.debug(line)
      break
    default:
      console.log(line)
  }
}

export function createLogger(service: string) {
  return {
    debug: (message: string, meta?: Partial<LogEntry>) => write(buildEntry('debug', service, message, meta)),
    info: (message: string, meta?: Partial<LogEntry>) => write(buildEntry('info', service, message, meta)),
    warn: (message: string, meta?: Partial<LogEntry>) => write(buildEntry('warn', service, message, meta)),
    error: (message: string, error?: Error, meta?: Partial<LogEntry>) => {
      write(buildEntry('error', service, message, {
        ...meta,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          code: (error as any).code,
        } : undefined,
      }))
    },
    fatal: (message: string, error?: Error, meta?: Partial<LogEntry>) => {
      write(buildEntry('fatal', service, message, {
        ...meta,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        } : undefined,
      }))
    },
    child: (childService: string) => createLogger(`${service}.${childService}`),
  }
}

export type Logger = ReturnType<typeof createLogger>
