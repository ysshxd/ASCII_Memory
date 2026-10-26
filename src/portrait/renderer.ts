import { getBlinkClosure, updatePointer } from './effects'
import { createGlyphRenderer } from './glyphRenderer'
import { createPortraitGrid } from './source'

import type { PointerState } from './effects'
import type { PortraitLayout } from './glyphRenderer'
import type { PortraitSource } from './source'

export type PortraitOptions = {
  isPlaying: boolean
  isMonochrome: boolean
  characterSize: number
}

export function createPortraitRenderer(
  canvas: HTMLCanvasElement,
  source: PortraitSource,
  initialOptions: PortraitOptions,
) {
  const gpu = createGlyphRenderer(canvas)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointer: PointerState = {
    x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, isActive: false,
  }
  let options = initialOptions
  let layout: PortraitLayout
  let sizeKey = ''
  let elapsed = reducedMotion.matches ? 2800 : 0
  let previousTime = 0
  let animationFrame = 0
  let isDisposed = false

  function paint() {
    if (!layout || isDisposed) {
      return
    }
    gpu.draw({
      time: elapsed,
      isMonochrome: options.isMonochrome,
      hasMotion: !reducedMotion.matches,
      pointerX: pointer.x,
      pointerY: pointer.y,
      pointerStrength: reducedMotion.matches ? 0 : pointer.strength,
      blinkLeft: reducedMotion.matches ? 0 : getBlinkClosure(elapsed, 0),
      blinkRight: reducedMotion.matches ? 0 : getBlinkClosure(elapsed, 1),
    })
  }

  function resetPointer() {
    pointer.isActive = false
    pointer.strength = 0
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const nextKey = `${bounds.width}:${bounds.height}:${pixelRatio}:${options.characterSize}`
    if (bounds.width < 1 || bounds.height < 1 || sizeKey === nextKey) {
      return
    }

    const portraitHeight = Math.min(
      bounds.height / 1.15,
      (bounds.width - 20) / source.aspectRatio / 1.12,
    )
    const portraitWidth = portraitHeight * source.aspectRatio
    const columns = Math.max(50, Math.round(portraitWidth / options.characterSize))
    const grid = createPortraitGrid(source, columns)
    layout = {
      width: bounds.width,
      height: bounds.height,
      left: (bounds.width - portraitWidth) / 2,
      top: (bounds.height - portraitHeight) / 2 - portraitHeight * 0.025,
      portraitWidth,
      portraitHeight,
      cellWidth: portraitWidth / grid.columns,
      cellHeight: portraitHeight / grid.rows,
    }
    gpu.resize(layout, pixelRatio)
    gpu.setGrid(grid)
    sizeKey = nextKey
    resetPointer()
    paint()
  }

  function animate(time: number) {
    animationFrame = 0
    if (isDisposed || !options.isPlaying || document.hidden || reducedMotion.matches) {
      return
    }

    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
    previousTime = time
    elapsed += delta * 1000
    updatePointer(pointer, delta)
    paint()
    animationFrame = requestAnimationFrame(animate)
  }

  function startAnimation() {
    if (!animationFrame && options.isPlaying && !document.hidden && !reducedMotion.matches) {
      previousTime = 0
      animationFrame = requestAnimationFrame(animate)
    }
  }

  function stopAnimation() {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
    previousTime = 0
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopAnimation()
    } else {
      startAnimation()
    }
  }

  function handleMotionChange() {
    stopAnimation()
    if (reducedMotion.matches) {
      elapsed = 2800
      resetPointer()
      paint()
    } else {
      startAnimation()
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' || reducedMotion.matches || !options.isPlaying) {
      return
    }
    const bounds = canvas.getBoundingClientRect()
    pointer.targetX = event.clientX - bounds.left
    pointer.targetY = event.clientY - bounds.top
    pointer.isActive = true
  }

  function handlePointerLeave() {
    pointer.isActive = false
  }

  try {
    resize()
  } catch (error) {
    gpu.dispose()
    throw error
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  reducedMotion.addEventListener('change', handleMotionChange)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerleave', handlePointerLeave)
  canvas.addEventListener('pointercancel', handlePointerLeave)
  startAnimation()

  return {
    update(nextOptions: PortraitOptions) {
      const hasSizeChanged = options.characterSize !== nextOptions.characterSize
      options = nextOptions
      if (hasSizeChanged) {
        resize()
      }

      if (!options.isPlaying) {
        stopAnimation()
      }
      paint()
      startAnimation()
    },
    replay() {
      elapsed = reducedMotion.matches ? 2800 : 0
      previousTime = 0
      resetPointer()
      paint()
      startAnimation()
    },
    dispose() {
      isDisposed = true
      stopAnimation()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotion.removeEventListener('change', handleMotionChange)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointercancel', handlePointerLeave)
      gpu.dispose()
    },
  }
}
