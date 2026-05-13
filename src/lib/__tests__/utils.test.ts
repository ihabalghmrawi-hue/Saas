import { describe, it, expect } from 'vitest'

describe('string utilities', () => {
  it('trims whitespace', () => {
    expect('  hello  '.trim()).toBe('hello')
  })

  it('splits comma-separated values', () => {
    expect('a,b,c'.split(',')).toEqual(['a', 'b', 'c'])
  })

  it('checks string inclusion', () => {
    expect('hello world'.includes('world')).toBe(true)
    expect('hello world'.includes('xyz')).toBe(false)
  })
})

describe('array utilities', () => {
  it('filters falsy values', () => {
    const arr = [0, 1, '', 'a', false, true, null, undefined]
    expect(arr.filter(Boolean)).toEqual([1, 'a', true])
  })

  it('maps values', () => {
    expect([1, 2, 3].map((x) => x * 2)).toEqual([2, 4, 6])
  })

  it('reduces to sum', () => {
    expect([1, 2, 3].reduce((a, b) => a + b, 0)).toBe(6)
  })
})

describe('object utilities', () => {
  it('merges objects', () => {
    expect({ ...{ a: 1 }, ...{ b: 2 } }).toEqual({ a: 1, b: 2 })
  })

  it('gets object keys', () => {
    expect(Object.keys({ a: 1, b: 2 })).toEqual(['a', 'b'])
  })
})
