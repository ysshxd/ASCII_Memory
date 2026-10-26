import { useEffect, useRef, useState } from 'react'

import { createPortraitRenderer } from './renderer'
import { decodePortraitSource } from './source'

import type { PortraitOptions } from './renderer'

type PortraitCanvasProps = PortraitOptions & {
  replayCount: number
}

function PortraitCanvas({
  isPlaying,
  isMonochrome,
  characterSize,
  replayCount,
}: PortraitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ReturnType<typeof createPortraitRenderer> | null>(null)
  const optionsRef = useRef({ isPlaying, isMonochrome, characterSize })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const mountedCanvas = canvasRef.current

    if (!mountedCanvas) {
      return
    }

    const canvas = mountedCanvas
    const request = new AbortController()
    let isCancelled = false

    async function initialize() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}portrait-glyphs.json`, {
          signal: request.signal,
        })
        if (!response.ok) {
          throw new Error('작품 데이터를 불러오지 못했습니다.')
        }
        const source = decodePortraitSource(await response.json())

        if (isCancelled) {
          return
        }

        rendererRef.current = createPortraitRenderer(
          canvas,
          source,
          optionsRef.current,
        )
        setStatus('ready')
      } catch {
        if (!isCancelled) {
          setStatus('error')
        }
      }
    }

    void initialize()

    return () => {
      isCancelled = true
      request.abort()
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [loadAttempt])

  useEffect(() => {
    optionsRef.current = { isPlaying, isMonochrome, characterSize }
    rendererRef.current?.update(optionsRef.current)
  }, [isPlaying, isMonochrome, characterSize])

  useEffect(() => {
    rendererRef.current?.replay()
  }, [replayCount])

  function handleRetry() {
    setStatus('loading')
    setLoadAttempt((attempt) => attempt + 1)
  }

  return (
    <div className="portrait-stage" aria-busy={status === 'loading'}>
      <canvas
        key={loadAttempt}
        ref={canvasRef}
        className="portrait-canvas"
        role="img"
        aria-label="검은 배경 위에 원본 사진의 인물을 문자로 표현한 ASCII 초상화"
      >
        이 작품은 WebGL 2를 지원하는 브라우저에서 볼 수 있습니다.
      </canvas>

      {status === 'loading' && (
        <div className="stage-message" role="status" aria-label="작품을 준비하는 중">
          <span className="loading-mark" aria-hidden="true" />
        </div>
      )}

      {status === 'error' && (
        <div className="stage-message" role="alert">
          <p>작품을 불러오지 못했습니다.</p>
          <button type="button" onClick={handleRetry}>다시 시도</button>
        </div>
      )}
    </div>
  )
}

export default PortraitCanvas
