import { fragmentShader, vertexShader } from './shaders'
import { characters } from './source'

import type { PortraitGrid } from './source'

export type PortraitLayout = {
  width: number
  height: number
  left: number
  top: number
  portraitWidth: number
  portraitHeight: number
  cellWidth: number
  cellHeight: number
}

type GlyphFrame = {
  time: number
  isMonochrome: boolean
  hasMotion: boolean
  pointerX: number
  pointerY: number
  pointerStrength: number
  blinkLeft: number
  blinkRight: number
}

const floatsPerGlyph = 19

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)

  if (!shader) {
    throw new Error('문자 셰이더를 만들 수 없습니다.')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`문자 셰이더 컴파일 실패: ${reason}`)
  }

  return shader
}

export function createGlyphRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false, powerPreference: 'high-performance',
  })

  if (!gl) {
    throw new Error('WebGL 2를 지원하는 브라우저에서 작품을 열어 주세요.')
  }

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
  const program = gl.createProgram()

  if (!program) {
    throw new Error('문자 렌더러를 만들 수 없습니다.')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const reason = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`문자 렌더러 연결 실패: ${reason}`)
  }

  const vao = gl.createVertexArray()
  const quadBuffer = gl.createBuffer()
  const instanceBuffer = gl.createBuffer()
  const texture = gl.createTexture()

  if (!vao || !quadBuffer || !instanceBuffer || !texture) {
    throw new Error('문자 그래픽 메모리를 준비할 수 없습니다.')
  }

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
    gl.STATIC_DRAW,
  )
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
  let offset = 0

  for (const [index, size] of [2, 3, 3, 4, 4, 3].entries()) {
    const location = index + 1
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, floatsPerGlyph * 4, offset * 4)
    gl.vertexAttribDivisor(location, 1)
    offset += size
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = Object.fromEntries([
    'uResolution', 'uOrigin', 'uPortraitSize', 'uQuadSize', 'uPointer', 'uBlink',
    'uPointerStrength', 'uTime', 'uMonochrome', 'uMotion', 'uAtlas', 'uGlyphCount',
  ].map((name) => [name, gl.getUniformLocation(program, name)]))

  gl.useProgram(program)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.disable(gl.DEPTH_TEST)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(uniforms.uAtlas, 0)
  gl.uniform1f(uniforms.uGlyphCount, characters.length)
  let glyphCount = 0
  let layout: PortraitLayout

  return {
    resize(nextLayout: PortraitLayout, pixelRatio: number) {
      layout = nextLayout
      canvas.width = Math.round(layout.width * pixelRatio)
      canvas.height = Math.round(layout.height * pixelRatio)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const tileWidth = Math.ceil(layout.cellWidth * pixelRatio) + 4
      const tileHeight = Math.ceil(layout.cellHeight * pixelRatio) + 4
      const atlas = document.createElement('canvas')
      atlas.width = tileWidth * characters.length
      atlas.height = tileHeight
      const context = atlas.getContext('2d')

      if (!context) {
        throw new Error('문자 모양을 준비할 수 없습니다.')
      }
      context.fillStyle = '#fff'
      context.font = `600 ${layout.cellWidth * pixelRatio / 0.602}px Consolas, monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      for (let index = 0; index < characters.length; index += 1) {
        context.fillText(characters[index], (index + 0.5) * tileWidth, tileHeight / 2)
      }

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
      gl.uniform2f(uniforms.uResolution, layout.width, layout.height)
      gl.uniform2f(uniforms.uOrigin, layout.left, layout.top)
      gl.uniform2f(uniforms.uPortraitSize, layout.portraitWidth, layout.portraitHeight)
      gl.uniform2f(uniforms.uQuadSize, tileWidth / pixelRatio, tileHeight / pixelRatio)
    },
    setGrid(grid: PortraitGrid) {
      // Upload once per grid change; animation frames update only a few uniforms.
      const instances = new Float32Array(grid.glyphs.length * floatsPerGlyph)

      for (let index = 0; index < grid.glyphs.length; index += 1) {
        const glyph = grid.glyphs[index]
        instances.set([
          glyph.x, glyph.y,
          ...glyph.color, ...glyph.closedColor,
          glyph.opacity, glyph.glyphIndex, glyph.closedGlyphIndex, glyph.eyeIndex,
          glyph.hairWeight, glyph.fringeWeight, glyph.seed, glyph.scatter,
          glyph.eyeFeather, Number(glyph.isWisp), glyph.eyeThreshold,
        ], index * floatsPerGlyph)
      }

      glyphCount = grid.glyphs.length
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW)
    },
    draw(frame: GlyphFrame) {
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(uniforms.uTime, frame.time / 1000)
      gl.uniform1f(uniforms.uMonochrome, Number(frame.isMonochrome))
      gl.uniform1f(uniforms.uMotion, Number(frame.hasMotion))
      gl.uniform2f(uniforms.uPointer, frame.pointerX, frame.pointerY)
      gl.uniform1f(uniforms.uPointerStrength, frame.pointerStrength)
      gl.uniform2f(uniforms.uBlink, frame.blinkLeft, frame.blinkRight)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, glyphCount)
    },
    dispose() {
      gl.deleteBuffer(quadBuffer)
      gl.deleteBuffer(instanceBuffer)
      gl.deleteTexture(texture)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
    },
  }
}
