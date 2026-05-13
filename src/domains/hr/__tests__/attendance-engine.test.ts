import { describe, it, expect, beforeEach } from 'vitest'
import { AttendanceEngine } from '../attendance/attendance-engine'
import { HrEventBus } from '../events/event-bus'
import { createMockDb, mockFromResult, mockFromError, type MockDb } from '../../test-helpers/mock-db'

describe('AttendanceEngine', () => {
  let db: MockDb
  let engine: AttendanceEngine
  const companyId = 'co-001'

  beforeEach(() => {
    HrEventBus.getInstance().removeAll()
    db = createMockDb()
    engine = new AttendanceEngine(db as any, companyId)
  })

  describe('checkIn', () => {
    it('creates session on existing log', async () => {
      mockFromResult(db, 'attendance_logs', {
        id: 'log-1', employee_id: '11111111-1111-1111-1111-111111111111', date: '2025-06-01', check_in: '2025-06-01T08:00:00Z', status: 'present',
      })
      mockFromResult(db, 'attendance_sessions', {
        id: 'sess-2', employee_id: '11111111-1111-1111-1111-111111111111', attendance_log_id: 'log-1', check_in: '2025-06-01T12:00:00Z',
      })
      const r = await engine.checkIn({ employee_id: '11111111-1111-1111-1111-111111111111', date: '2025-06-01' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.attendanceLogId).toBe('log-1')
    })

    it('returns validation error for invalid input', async () => {
      const r = await engine.checkIn({ employee_id: 'not-a-uuid' } as any)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('VALIDATION_ERROR')
    })

    it('returns error on session creation failure', async () => {
      mockFromResult(db, 'attendance_logs', {
        id: 'log-1', employee_id: '11111111-1111-1111-1111-111111111111', date: '2025-06-01', check_in: '2025-06-01T08:00:00Z', status: 'present',
      })
      mockFromError(db, 'attendance_sessions', 'DB error', 'INSERT_ERROR')
      const r = await engine.checkIn({ employee_id: '11111111-1111-1111-1111-111111111111', date: '2025-06-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('CHECK_IN_FAILED')
    })
  })

  describe('checkOut', () => {
    it('checks out successfully', async () => {
      mockFromResult(db, 'attendance_sessions', {
        id: 'sess-1', employee_id: 'emp-1', attendance_log_id: 'log-1',
        check_in: '2025-06-01T08:00:00Z', check_out: '2025-06-01T17:00:00Z',
      })
      mockFromResult(db, 'attendance_logs', {
        id: 'log-1', employee_id: 'emp-1', date: '2025-06-01',
        check_in: '2025-06-01T08:00:00Z', working_minutes: 0,
      })
      const r = await engine.checkOut({ session_id: 'sess-1' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.attendanceLogId).toBe('log-1')
    })

    it('returns error when log not found', async () => {
      mockFromResult(db, 'attendance_sessions', {
        id: 'sess-1', employee_id: 'emp-1', check_in: '2025-06-01T08:00:00Z', check_out: '2025-06-01T17:00:00Z',
      })
      mockFromResult(db, 'attendance_logs', null)
      const r = await engine.checkOut({ session_id: 'sess-1' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NOT_FOUND')
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'attendance_sessions', 'DB error', 'UPDATE_ERROR')
      const r = await engine.checkOut({ session_id: 'sess-1' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('CHECK_OUT_FAILED')
    })
  })

  describe('recordOvertime', () => {
    it('records overtime successfully', async () => {
      mockFromResult(db, 'overtime_entries', {
        id: 'ot-1', employee_id: 'emp-1', date: '2025-06-01', overtime_type: 'weekday',
        start_time: '2025-06-01T18:00:00Z', end_time: '2025-06-01T20:00:00Z',
        total_minutes: 120, rate_multiplier: 1.5, amount: 0,
      })
      const r = await engine.recordOvertime({
        employee_id: 'emp-1', date: '2025-06-01', overtime_type: 'weekday',
        start_time: '2025-06-01T18:00:00Z', end_time: '2025-06-01T20:00:00Z',
      })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.overtime_type).toBe('weekday')
    })

    it('returns error for invalid duration', async () => {
      const r = await engine.recordOvertime({
        employee_id: 'emp-1', date: '2025-06-01', overtime_type: 'weekday',
        start_time: '2025-06-01T20:00:00Z', end_time: '2025-06-01T18:00:00Z',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_DURATION')
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'overtime_entries', 'DB error', 'INSERT_ERROR')
      const r = await engine.recordOvertime({
        employee_id: 'emp-1', date: '2025-06-01', overtime_type: 'weekday',
        start_time: '2025-06-01T18:00:00Z', end_time: '2025-06-01T20:00:00Z',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('OVERTIME_FAILED')
    })
  })

  describe('getAttendanceRange', () => {
    it('returns attendance logs', async () => {
      mockFromResult(db, 'attendance_logs', [
        { id: 'log-1', employee_id: 'emp-1', date: '2025-06-01', status: 'present', working_minutes: 480 },
      ])
      const r = await engine.getAttendanceRange('2025-06-01', '2025-06-30')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toHaveLength(1)
    })

    it('handles empty result', async () => {
      mockFromResult(db, 'attendance_logs', [])
      const r = await engine.getAttendanceRange('2025-06-01', '2025-06-30')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toHaveLength(0)
    })

    it('returns error on db failure', async () => {
      mockFromError(db, 'attendance_logs', 'DB error', 'FETCH_ERROR')
      const r = await engine.getAttendanceRange('2025-06-01', '2025-06-30')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('FETCH_FAILED')
    })
  })

  describe('isHoliday', () => {
    it('detects weekend day', async () => {
      mockFromResult(db, 'holiday_calendars', null)
      const r = await engine.isHoliday('2025-06-07')
      expect(r.isHoliday).toBe(true)
      expect(r.isWeekend).toBe(true)
    })

    it('detects holiday from calendar', async () => {
      mockFromResult(db, 'holiday_calendars', {
        id: 'cal-1', year: 2025, entries: [{ date: '2025-06-01', name: 'Eid' }],
      })
      const r = await engine.isHoliday('2025-06-01')
      expect(r.isHoliday).toBe(true)
      expect(r.name).toBe('Eid')
    })

    it('detects regular weekday', async () => {
      mockFromResult(db, 'holiday_calendars', { id: 'cal-1', year: 2025, entries: [] })
      const r = await engine.isHoliday('2025-06-02')
      expect(r.isHoliday).toBe(false)
      expect(r.isWeekend).toBe(false)
    })
  })
})
