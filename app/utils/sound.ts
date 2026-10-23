export interface Sound {
  src: string
  volume: number
}

export const UI_SOUNDS = {
  click: { src: '/sounds/click_sound.mp3', volume: 0.3 }
} satisfies Record<string, Sound>

const MUSIC_VOLUME = 0.075
const SILENCE = 0.01
const FADE_IN_S = 0.03
const FADE_OUT_S = 0.08
const MUSIC_FADE_MS = 400
const MAX_EFFECT_DELAY_MS = 150

interface Clip {
  buffer: AudioBuffer
  start: number
  end: number
}

export interface LoopHandle {
  stop: () => void
}

let context: AudioContext | null = null
const files = new Map<string, Promise<ArrayBuffer>>()
const clips = new Map<string, Promise<Clip | null>>()

function fetchFile(src: string): Promise<ArrayBuffer> {
  let file = files.get(src)
  if (!file) {
    file = fetch(src).then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(src)))
    file.catch(() => files.delete(src))
    files.set(src, file)
  }
  return file
}

function audibleRange(buffer: AudioBuffer): [number, number] {
  let first = buffer.length
  let last = -1
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    let i = 0
    while (i < first && Math.abs(data[i]!) < SILENCE) i++
    first = Math.min(first, i)
    let j = data.length - 1
    while (j > last && Math.abs(data[j]!) < SILENCE) j--
    last = Math.max(last, j)
  }
  if (last < first) return [0, buffer.duration]
  return [first / buffer.sampleRate, (last + 1) / buffer.sampleRate]
}

function loadClip(src: string): Promise<Clip | null> {
  const audio = context
  if (!audio) return Promise.resolve(null)
  let clip = clips.get(src)
  if (!clip) {
    clip = fetchFile(src)
      .then(data => audio.decodeAudioData(data.slice(0)))
      .then((buffer) => {
        const [start, end] = audibleRange(buffer)
        return { buffer, start, end }
      })
      .catch(() => {
        clips.delete(src)
        return null
      })
    clips.set(src, clip)
  }
  return clip
}

export function unlockAudio() {
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    context = new Context()
    for (const src of files.keys()) loadClip(src)
  }
  if (context.state !== 'running') context.resume().catch(() => {})
}

export function suspendAudio() {
  cancelAnimationFrame(fadeFrame)
  music?.pause()
  if (context?.state === 'running') context.suspend().catch(() => {})
}

export function preloadSounds(sounds: Sound[]) {
  for (const { src } of sounds) {
    fetchFile(src).catch(() => {})
    if (context) loadClip(src)
  }
}

function connect(source: AudioBufferSourceNode, volume: number): GainNode {
  const gain = context!.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(context!.destination)
  return gain
}

export function playSound({ src, volume }: Sound) {
  if (!context) return
  const requested = performance.now()
  loadClip(src).then((clip) => {
    if (!clip || !context || performance.now() - requested > MAX_EFFECT_DELAY_MS) return
    const source = context.createBufferSource()
    source.buffer = clip.buffer
    connect(source, volume)
    source.start(0, clip.start, clip.end - clip.start)
  })
}

export function loopSound({ src, volume }: Sound): LoopHandle {
  let stopped = false
  let playing: { source: AudioBufferSourceNode, gain: GainNode } | null = null
  if (context) {
    loadClip(src).then((clip) => {
      if (stopped || !clip || !context) return
      const source = context.createBufferSource()
      source.buffer = clip.buffer
      source.loop = true
      source.loopStart = clip.start
      source.loopEnd = clip.end
      const gain = connect(source, 0)
      const now = context.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + FADE_IN_S)
      source.start(now, clip.start + Math.random() * (clip.end - clip.start))
      playing = { source, gain }
    })
  }
  return {
    stop() {
      if (stopped) return
      stopped = true
      if (!playing || !context) return
      const { source, gain } = playing
      const now = context.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S)
      source.stop(now + FADE_OUT_S + 0.02)
    }
  }
}

let music: HTMLAudioElement | null = null
let musicWanted: string | null = null
let musicBlocked = false
let musicDuck = 1
let duckTimer: ReturnType<typeof setTimeout> | undefined
let fadeFrame = 0

function fadeMusic(to: number, done?: () => void) {
  cancelAnimationFrame(fadeFrame)
  const element = music
  if (!element) return
  const from = element.volume
  const started = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - started) / MUSIC_FADE_MS))
    element.volume = Math.min(1, Math.max(0, from + (to - from) * t))
    if (t < 1) fadeFrame = requestAnimationFrame(step)
    else done?.()
  }
  fadeFrame = requestAnimationFrame(step)
}

function startMusic() {
  if (!music || !musicWanted) return
  if (!music.paused && !musicBlocked) {
    fadeMusic(MUSIC_VOLUME * musicDuck)
    return
  }
  music.volume = 0
  music.play().then(() => {
    musicBlocked = false
    fadeMusic(MUSIC_VOLUME * musicDuck)
  }).catch(() => {
    musicBlocked = true
  })
}

export function setMusic(src: string | null) {
  musicWanted = src
  if (!src) {
    musicBlocked = false
    if (music && !music.paused) fadeMusic(0, () => music?.pause())
    return
  }
  if (!music) {
    music = new Audio()
    music.loop = true
    music.preload = 'auto'
  }
  if (!music.src.endsWith(src)) music.src = src
  startMusic()
}

export function resumeMusic() {
  if (musicBlocked) startMusic()
}

export function duckMusic(level: number, seconds: number) {
  musicDuck = level
  if (music && !music.paused) fadeMusic(MUSIC_VOLUME * level)
  clearTimeout(duckTimer)
  duckTimer = setTimeout(() => {
    musicDuck = 1
    if (music && !music.paused && musicWanted) fadeMusic(MUSIC_VOLUME)
  }, seconds * 1000)
}
