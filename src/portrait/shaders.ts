export const vertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aPosition;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec3 aClosedColor;
layout(location = 4) in vec4 aAppearance;
layout(location = 5) in vec4 aMotion;
layout(location = 6) in vec3 aEffects;

uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform vec2 uPortraitSize;
uniform vec2 uQuadSize;
uniform vec2 uPointer;
uniform vec2 uBlink;
uniform float uPointerStrength;
uniform float uTime;
uniform float uMonochrome;
uniform float uMotion;

out vec2 vUv;
flat out vec3 vColor;
flat out vec2 vGlyphs;
flat out float vClosure;
flat out float vOpacity;

void main() {
  float progress = clamp(uTime / 2.8, 0.0, 1.0);
  float scale = uPortraitSize.x / 500.0;
  float seed = aMotion.z;
  float scatter = aMotion.w;
  float isWisp = aEffects.y;
  vec2 position = uOrigin + aPosition * uPortraitSize;

  float distanceFromFace = length((aPosition - vec2(0.5, 0.48)) * vec2(1.2, 0.8));
  float delay = distanceFromFace * 0.25 + seed * 0.22;
  float reveal = smoothstep(delay, delay + 0.55, progress);
  float spread = (8.0 + seed * 26.0) * scale * pow(1.0 - reveal, 2.0);
  float angle = scatter * 6.2831853;
  position += vec2(cos(angle), sin(angle)) * spread * (1.0 - isWisp);

  float wind = smoothstep(0.3, 1.0, progress) * uMotion;
  float phase = aPosition.x * 38.0 + aPosition.y * 16.0;
  float hair = aMotion.x * wind * scale;
  float fringe = aMotion.y * wind * scale;
  position.x += hair * (sin(uTime * 0.85 + aPosition.y * 9.0) * 3.8
    + sin(uTime * 1.4 + aPosition.x * 7.0) * 1.1);
  position.x += fringe * (sin(uTime * 1.6 + phase) * 6.0 + sin(uTime * 0.7) * 2.0);
  position.y += hair * sin(uTime * 0.95 + aPosition.x * 11.0) * 1.3
    + fringe * sin(uTime * 1.3 + phase) * 2.5;

  float wispPhase = seed * 6.2831853;
  position += vec2(sin(uTime * 0.55 + wispPhase) * 7.0,
    cos(uTime * 0.4 + wispPhase) * 4.0) * scale * isWisp * uMotion;

  vec2 delta = position - uPointer;
  float radius = min(70.0, uPortraitSize.x * 0.12);
  float distanceToPointer = length(delta);
  float influence = pow(max(0.0, 1.0 - distanceToPointer / radius), 2.0);
  vec2 direction = delta / max(distanceToPointer, 1.0);
  vec2 tangent = vec2(-direction.y, direction.x);
  position += (direction * 0.75 + tangent * 0.25) * influence
    * min(11.0, uPortraitSize.x * 0.022) * uPointerStrength;

  float closure = 0.0;
  if (aAppearance.w > -0.5) {
    float blink = mix(uBlink.x, uBlink.y, step(0.5, aAppearance.w));
    closure = smoothstep(aEffects.z - 0.24, aEffects.z + 0.24, blink) * aEffects.x;
  }
  vec3 color = mix(aColor, aClosedColor, closure);
  float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vColor = mix(color, vec3(gray), uMonochrome);
  vGlyphs = aAppearance.yz;
  vClosure = closure;
  float wispReveal = smoothstep(0.4, 1.0, progress);
  float shimmer = 0.78 + sin(uTime * 0.7 * uMotion + wispPhase) * 0.22;
  vOpacity = aAppearance.x * mix(reveal, wispReveal * shimmer, isWisp);
  vUv = aCorner + 0.5;
  vec2 clip = (position + aCorner * uQuadSize) / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`

export const fragmentShader = `#version 300 es
precision highp float;

uniform sampler2D uAtlas;
uniform float uGlyphCount;
in vec2 vUv;
flat in vec3 vColor;
flat in vec2 vGlyphs;
flat in float vClosure;
flat in float vOpacity;
out vec4 outputColor;

void main() {
  vec2 openUv = vec2((vGlyphs.x + vUv.x) / uGlyphCount, vUv.y);
  vec2 closedUv = vec2((vGlyphs.y + vUv.x) / uGlyphCount, vUv.y);
  float coverage = mix(texture(uAtlas, openUv).a, texture(uAtlas, closedUv).a, vClosure);
  float alpha = coverage * vOpacity;
  if (alpha < 0.005) discard;
  outputColor = vec4(vColor * alpha, alpha);
}
`
