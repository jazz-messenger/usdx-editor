export function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    if (b < 0x80) { i++; continue }
    let len: number
    if ((b & 0xE0) === 0xC0) len = 2
    else if ((b & 0xF0) === 0xE0) len = 3
    else if ((b & 0xF8) === 0xF0) len = 4
    else return false  // 0x80-0xBF, 0xF8-0xFF — invalid start byte
    for (let j = 1; j < len; j++) {
      if (i + j >= bytes.length || (bytes[i + j] & 0xC0) !== 0x80) return false
    }
    i += len
  }
  return true
}

/**
 * Detect the text encoding of a byte sequence that is *not* valid UTF-8.
 *
 * Distinguishes Mac Roman from Windows-1252 by looking for bytes that are
 * accented letters in Mac Roman but very uncommon symbols in Windows-1252.
 *
 * Excluded: 0x80 (€), 0x82 (‚), 0x84 („), 0x85 (…), and the range 0x90–0x99
 * (curly quotes ', ', ", ", bullets, en/em dashes, ™) plus 0x9B–0x9E — all
 * normal Windows-1252 punctuation that appears in English lyrics and would
 * cause false-positive Mac Roman detection (the apostrophe bug: 0x92 = ' in
 * Windows-1252 but í in Mac Roman).
 *
 * Mac Roman → Windows-1252 meaning for each included byte:
 *   0x81 Å → (undef)  0x83 É → ƒ    0x86 Ü → †
 *   0x87 á → ‡        0x88 à → ˆ    0x89 â → ‰
 *   0x8A ä → Š        0x8B ã → ‹    0x8C å → Œ
 *   0x8D ç → (undef)  0x8E é → Ž    0x8F è → (undef)
 *   0x9A ö → š        0x9F ü → Ÿ
 */
export function detectEncoding(bytes: Uint8Array): string {
  if (isValidUtf8(bytes)) return 'utf-8'

  const MAC_ROMAN_INDICATORS = new Set([
    0x81, 0x83, 0x86,
    0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
    0x9A, 0x9F,
  ])

  for (const b of bytes) {
    if (MAC_ROMAN_INDICATORS.has(b)) return 'macintosh'
  }
  return 'windows-1252'
}
