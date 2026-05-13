export {
  generateCorrelationId,
  setCorrelationId,
  getCorrelationId,
  setCausationId,
  getCausationId,
  startTrace,
  endTrace,
  getTrace,
  correlationHeaders,
  extractCorrelationContext,
  createTraceLogger,
} from './correlation'

export type { TraceContext } from './correlation'

export { createLogger } from './logger'
export type { LogLevel, LogEntry, Logger } from './logger'

export {
  startSpan,
  startChildSpan,
  endSpan,
  addSpanEvent,
  setSpanAttribute,
  getSpan,
  getTrace as getTraceSpans,
  clearSpans,
  getActiveSpanCount,
  exportTrace,
  traceAsync,
} from './tracer'

export type { Span, SpanStatus, TraceEvent } from './tracer'
