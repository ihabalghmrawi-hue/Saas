import { vi } from 'vitest'

type QueryResult<T = any> = { data: T | null; error: any | null; count?: number | null }
type ChainableQuery = ReturnType<typeof chainableQuery>

function chainableQuery() {
  const chain: any = {
    _result: { data: null, error: null, count: null },
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    like: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    containedBy: vi.fn(() => chain),
    rangeGt: vi.fn(() => chain),
    rangeGte: vi.fn(() => chain),
    rangeLt: vi.fn(() => chain),
    rangeLte: vi.fn(() => chain),
    rangeAdjacent: vi.fn(() => chain),
    overlaps: vi.fn(() => chain),
    textSearch: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    not: vi.fn(() => chain),
    or: vi.fn(() => chain),
    and: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(chain._result)),
    maybeSingle: vi.fn(() => Promise.resolve(chain._result)),
    then: vi.fn((resolve: Function) => resolve(chain._result)),
    abortSignal: vi.fn(() => chain),
    returns: (result: QueryResult) => { chain._result = result; return chain },
    throwError: (message: string, code?: string) => { chain._result = { data: null, error: { message, code: code || 'ERROR' }, count: null }; return chain },
  }
  return chain
}

export function createMockDb() {
  const tables = new Map<string, ChainableQuery>()

  const db: Record<string, any> = {
    from: vi.fn((table: string) => {
      if (!tables.has(table)) tables.set(table, chainableQuery())
      return tables.get(table)
    }),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    schema: vi.fn(() => db),
    _tables: tables,
  }

  return db
}

export type MockDb = ReturnType<typeof createMockDb>

export function mockRpc(db: MockDb, result: any, error: any = null) {
  db.rpc.mockReturnValue(Promise.resolve({ data: result, error }))
}

export function mockRpcError(db: MockDb, message: string, code: string = 'ERROR') {
  db.rpc.mockReturnValue(Promise.resolve({ data: null, error: { message, code } } as any))
}

export function mockFromResult(db: MockDb, table: string, result: any, error: any = null, count: number | null = null) {
  const q = db.from(table)
  q._result = { data: result, error, count }
}

export function mockFromError(db: MockDb, table: string, message: string, code: string = 'ERROR') {
  mockFromResult(db, table, null, { message, code })
}

export { vi }
