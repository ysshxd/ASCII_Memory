type Color = [number, number, number]

export type PortraitGlyph = {
  x: number
  y: number
  color: Color
  closedColor: Color
  glyphIndex: number
  closedGlyphIndex: number
  opacity: number
  hairWeight: number
  fringeWeight: number
  eyeIndex: number
  eyeFeather: number
  eyeThreshold: number
  seed: number
  scatter: number
  isWisp: boolean
  isUnderlay?: boolean
}

export type PortraitSource = {
  columns: number
  rows: number
  aspectRatio: number
  cells: Map<number, PortraitGlyph>
  wisps: PortraitGlyph[]
}

export type PortraitGrid = {
  glyphs: PortraitGlyph[]
  columns: number
  rows: number
}

export const characters = '.:-=+*#%@'

export function randomValue(value: number) {
  let mixed = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295
}

export function decodePortraitSource(payload: unknown): PortraitSource {
  if (!payload || typeof payload !== 'object') {
    throw new Error('작품 데이터를 읽을 수 없습니다.')
  }

  const field = payload as Record<string, unknown>
  const { columns, rows, aspectRatio } = field
  if (
    field.version !== 1 || !Number.isInteger(columns) || !Number.isInteger(rows) ||
    typeof columns !== 'number' || columns < 1 || columns > 1024 ||
    typeof rows !== 'number' || rows < 1 || rows > 1024 ||
    typeof aspectRatio !== 'number' || !Number.isFinite(aspectRatio) || aspectRatio <= 0 ||
    !Array.isArray(field.glyphs) || field.glyphs.length > columns * rows * 2
  ) {
    throw new Error('지원하지 않는 작품 데이터입니다.')
  }

  const cells = new Map<number, PortraitGlyph>()
  const wisps: PortraitGlyph[] = []

  for (const values of field.glyphs) {
    if (
      !Array.isArray(values) || values.length !== 19 ||
      !values.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      throw new Error('문자 데이터가 올바르지 않습니다.')
    }

    const glyph: PortraitGlyph = {
      x: values[0], y: values[1],
      color: [values[2], values[3], values[4]],
      closedColor: [values[5], values[6], values[7]],
      opacity: values[8], glyphIndex: values[9], closedGlyphIndex: values[10],
      eyeIndex: values[11], hairWeight: values[12], fringeWeight: values[13],
      seed: values[14], scatter: values[15], eyeFeather: values[16],
      isWisp: values[17] === 1, eyeThreshold: values[18],
    }

    if (glyph.isWisp) {
      wisps.push(glyph)
    } else {
      const column = Math.floor(glyph.x * columns)
      const row = Math.floor(glyph.y * rows)
      cells.set(row * columns + column, glyph)
    }
  }

  return { columns, rows, aspectRatio, cells, wisps }
}

export function createPortraitGrid(source: PortraitSource, requestedColumns: number): PortraitGrid {
  const columns = Math.max(1, Math.min(source.columns, Math.round(requestedColumns)))
  const rows = Math.max(1, Math.round(columns / source.aspectRatio / 1.65))
  const glyphs: PortraitGlyph[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column + 0.5) / columns
      const y = (row + 0.5) / rows
      const sourceColumn = Math.min(source.columns - 1, Math.floor(x * source.columns))
      const sourceRow = Math.min(source.rows - 1, Math.floor(y * source.rows))
      const glyph = source.cells.get(sourceRow * source.columns + sourceColumn)

      if (glyph) {
        glyphs.push({ ...glyph, x, y })
      }
    }
  }

  const density = (columns / source.columns) ** 2
  for (const [index, glyph] of source.wisps.entries()) {
    if (randomValue(index + 14731) < density) {
      glyphs.push(glyph)
    }
  }

  return { glyphs: [...createForeheadUnderlay(glyphs, columns), ...glyphs], columns, rows }
}

function createForeheadUnderlay(glyphs: PortraitGlyph[], columns: number) {
  const skinByColumn = new Map<number, PortraitGlyph>()

  for (const glyph of glyphs) {
    const [red, green, blue] = glyph.color
    if (
      glyph.isWisp || glyph.y < 0.35 || glyph.y > 0.5 ||
      glyph.hairWeight > 0.05 || red < 0.5 || red - green < 0.09 || red - blue < 0.12
    ) {
      continue
    }
    const column = Math.floor(glyph.x * columns)
    const existing = skinByColumn.get(column)
    if (!existing || glyph.y < existing.y) {
      skinByColumn.set(column, glyph)
    }
  }

  const underlay: PortraitGlyph[] = []
  for (const glyph of glyphs) {
    if (
      glyph.isWisp || glyph.fringeWeight < 0.08 || glyph.y < 0.32 || glyph.y > 0.46 ||
      glyph.x < 0.2 || glyph.x > 0.8
    ) {
      continue
    }

    const column = Math.floor(glyph.x * columns)
    let skin = skinByColumn.get(column)
    for (let distance = 1; !skin && distance <= Math.ceil(columns * 0.05); distance += 1) {
      skin = skinByColumn.get(column - distance) ?? skinByColumn.get(column + distance)
    }
    if (!skin) {
      continue
    }

    const depth = Math.max(0, skin.y - glyph.y)
    const feather = Math.max(0, 1 - depth / 0.065) ** 2
    if (feather === 0) {
      continue
    }
    underlay.push({
      ...glyph,
      color: skin.color,
      closedColor: skin.color,
      glyphIndex: skin.glyphIndex,
      closedGlyphIndex: skin.glyphIndex,
      opacity: glyph.opacity * feather * 0.6,
      eyeIndex: -1,
      eyeFeather: 0,
      isUnderlay: true,
    })
  }

  return underlay
}
