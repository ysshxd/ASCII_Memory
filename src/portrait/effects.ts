export type PointerState = {
  x: number
  y: number
  targetX: number
  targetY: number
  strength: number
  isActive: boolean
}

export function getBlinkClosure(time: number, eyeIndex: number) {
  const phase = ((time - 2800) / 1000 - eyeIndex * 0.008) % 32

  for (const start of [1.4, 7.3, 14.1, 19.6, 20.35, 27.4]) {
    const age = phase - start
    if (age < 0 || age > 0.575) {
      continue
    }

    if (age < 0.22) {
      return easeEyelid(age / 0.22)
    }

    if (age < 0.275) {
      return 1
    }
    return 1 - easeEyelid((age - 0.275) / 0.3)
  }

  return 0
}

function easeEyelid(progress: number) {
  // Zero velocity and acceleration at both ends keep the lid from snapping.
  return progress ** 3 * (progress * (progress * 6 - 15) + 10)
}

export function updatePointer(pointer: PointerState, delta: number) {
  const step = Math.min(delta, 0.05)

  if (pointer.isActive) {
    const follow = pointer.strength === 0 ? 1 : 1 - Math.exp(-40 * step)
    pointer.x += (pointer.targetX - pointer.x) * follow
    pointer.y += (pointer.targetY - pointer.y) * follow
  }

  const target = pointer.isActive ? 1 : 0
  const response = 1 - Math.exp(-(pointer.isActive ? 32 : 12) * step)
  pointer.strength += (target - pointer.strength) * response

  if (!pointer.isActive && pointer.strength < 0.0005) {
    pointer.strength = 0
  }
}
