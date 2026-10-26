import { useState } from 'react'

import type { CSSProperties } from 'react'

import PortraitCanvas from './portrait/PortraitCanvas'

import './App.css'

function App() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMonochrome, setIsMonochrome] = useState(false)
  const [characterSize, setCharacterSize] = useState(3)
  const [replayCount, setReplayCount] = useState(0)
  const sliderStyle = {
    '--range-progress': `${((characterSize - 3) / 4) * 100}%`,
  } as CSSProperties

  function handleReplay() {
    setIsPlaying(true)
    setReplayCount((count) => count + 1)
  }

  return (
    <main className="gallery">
      <header className="gallery-header">
        <a className="wordmark" href="#" aria-label="ASCII 처음으로">
          <span className="wordmark-bracket" aria-hidden="true">[</span>
          ASCII
          <span className="wordmark-bracket" aria-hidden="true">]</span>
        </a>
      </header>

      <section className="artwork" aria-label="ASCII 초상 작품">
        <PortraitCanvas
          isPlaying={isPlaying}
          isMonochrome={isMonochrome}
          characterSize={characterSize}
          replayCount={replayCount}
        />
      </section>

      <footer className="gallery-footer">
        <div className="controls" role="group" aria-label="작품 조절">
          <button
            type="button"
            className="play-button"
            onClick={() => setIsPlaying((playing) => !playing)}
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            <span className={isPlaying ? 'pause-icon' : 'play-icon'} aria-hidden="true" />
            {isPlaying ? '일시정지' : '재생'}
          </button>

          <button type="button" className="replay-button" onClick={handleReplay}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 7a6.5 6.5 0 1 1-.1 5M4 3v4h4" />
            </svg>
            다시 보기
          </button>

          <span className="control-divider" aria-hidden="true" />

          <div className="color-options" role="group" aria-label="색상 모드">
            <button
              type="button"
              aria-pressed={!isMonochrome}
              onClick={() => setIsMonochrome(false)}
            >
              컬러
            </button>
            <button
              type="button"
              aria-pressed={isMonochrome}
              onClick={() => setIsMonochrome(true)}
            >
              흑백
            </button>
          </div>

          <span className="control-divider size-divider" aria-hidden="true" />

          <label className="size-control" htmlFor="character-size">
            <span className="size-label">문자 크기</span>
            <output htmlFor="character-size">{characterSize.toFixed(1)}<span>px</span></output>
            <input
              id="character-size"
              type="range"
              min="3"
              max="7"
              step="0.5"
              value={characterSize}
              style={sliderStyle}
              aria-valuetext={`${characterSize} 픽셀`}
              onChange={(event) => setCharacterSize(Number(event.target.value))}
            />
          </label>
        </div>
      </footer>
    </main>
  )
}

export default App
