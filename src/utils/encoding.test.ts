import { describe, it, expect } from 'vitest'
import { isValidUtf8, detectEncoding } from './encoding'

// ── Helpers ────────────────────────────────────────────────────────────────────

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// ── isValidUtf8 ────────────────────────────────────────────────────────────────

describe('isValidUtf8', () => {
  it('accepts an empty byte array', () => {
    expect(isValidUtf8(bytes())).toBe(true)
  })

  it('accepts pure ASCII', () => {
    expect(isValidUtf8(encodeUtf8('Hello World'))).toBe(true)
  })

  it('accepts valid 2-byte UTF-8 sequences (Latin extended)', () => {
    // "ä" in UTF-8 is 0xC3 0xA4
    expect(isValidUtf8(encodeUtf8('Mötley Crüe'))).toBe(true)
  })

  it('accepts valid 3-byte UTF-8 sequences (CJK)', () => {
    // Japanese characters are 3-byte sequences
    expect(isValidUtf8(encodeUtf8('こんにちは'))).toBe(true)
  })

  it('accepts a typical German lyric line', () => {
    expect(isValidUtf8(encodeUtf8('Über den Wolken muss die Freiheit wohl grenzenlos sein'))).toBe(true)
  })

  it('rejects an isolated continuation byte (0x80)', () => {
    expect(isValidUtf8(bytes(0x80))).toBe(false)
  })

  it('rejects an invalid start byte (0xFF)', () => {
    expect(isValidUtf8(bytes(0xFF))).toBe(false)
  })

  it('rejects a 2-byte sequence missing its continuation byte', () => {
    // 0xC3 starts a 2-byte sequence but is followed by ASCII 'A' (0x41)
    expect(isValidUtf8(bytes(0xC3, 0x41))).toBe(false)
  })

  it('rejects a truncated 3-byte sequence at end of input', () => {
    // 0xE2 starts a 3-byte sequence; only 1 continuation byte follows
    expect(isValidUtf8(bytes(0xE2, 0x80))).toBe(false)
  })

  it('rejects a Windows-1252 byte with a typical accented character (0x84 = „)', () => {
    // 0x84 is a standalone byte in Windows-1252 (low double quotation mark „)
    // It is an invalid start byte in UTF-8
    expect(isValidUtf8(bytes(0x41, 0x84, 0x41))).toBe(false)
  })
})

// ── detectEncoding ─────────────────────────────────────────────────────────────

describe('detectEncoding', () => {
  it('returns "utf-8" for pure ASCII input', () => {
    expect(detectEncoding(encodeUtf8('Hello World'))).toBe('utf-8')
  })

  it('returns "utf-8" for valid UTF-8 with multi-byte characters', () => {
    expect(detectEncoding(encodeUtf8('Über alles'))).toBe('utf-8')
  })

  it('returns "windows-1252" when only Windows-1252–specific bytes are present', () => {
    // 0x84 = „ (low double quotation mark) — valid in Windows-1252, invalid in UTF-8 and Mac Roman
    const winBytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x84])
    expect(detectEncoding(winBytes)).toBe('windows-1252')
  })

  it('returns "macintosh" when a Mac Roman indicator byte is present', () => {
    // 0x8A = ä in Mac Roman — extremely unlikely in Windows-1252 (maps to Š)
    const macBytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x8A])
    expect(detectEncoding(macBytes)).toBe('macintosh')
  })

  it('returns "macintosh" for byte 0x9F (ü in Mac Roman, Ÿ in Windows-1252)', () => {
    const macBytes = new Uint8Array([0x9F, 0x62, 0x65, 0x72])
    expect(detectEncoding(macBytes)).toBe('macintosh')
  })

  it('returns "windows-1252" and NOT "macintosh" for byte 0x92 (apostrophe in Win-1252)', () => {
    // 0x92 = curly apostrophe ' in Windows-1252 — common in English lyrics.
    // In Mac Roman, 0x92 = a different character. The function should NOT flag 0x92
    // as a Mac Roman indicator, avoiding the "apostrophe bug".
    const winBytes = new Uint8Array([0x49, 0x92, 0x6D])  // "I'm" in Windows-1252
    expect(detectEncoding(winBytes)).toBe('windows-1252')
  })

  it('returns "utf-8" for an empty input', () => {
    expect(detectEncoding(bytes())).toBe('utf-8')
  })
})
