/**
 * 白噪音发生器 - Web Audio API 程序化生成
 * - 雨声：白噪音 + 低通 + 微脉冲
 * - 咖啡馆：粉红噪音 + 中频
 * - 键盘：白噪音 + 短脉冲
 * - 森林：风声 + 鸟鸣合成
 * - 0 音频资源，0 联网
 *
 * v0.4.8：修复 forest 模式 setInterval / OscillatorNode 泄漏
 *   - 所有定时器 id 统一收集到 active.intervals
 *   - 所有音源节点统一收集到 active.nodes
 *   - 提供 dispose()，供应用卸载时调用
 */
import { ref, computed, onScopeDispose } from 'vue'

export type NoiseType = 'none' | 'rain' | 'cafe' | 'keyboard' | 'forest'

interface ActiveNoise {
  ctx: AudioContext
  nodes: AudioNode[]
  gain: GainNode
  intervals: number[]
  timeouts: number[]
}

let active: ActiveNoise | null = null
const current = ref<NoiseType>('none')
const volume = ref(0.4)
const playing = computed(() => current.value !== 'none')

/** 简单白噪音 buffer */
function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = ctx.sampleRate * seconds
  const buf = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buf
}

/** 粉红噪音（1/f 噪声） */
function createPinkNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = ctx.sampleRate * seconds
  const buf = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buf
}

function stopActive() {
  if (!active) return
  const { ctx, nodes, gain, intervals, timeouts } = active
  // 先摘掉引用，避免重入
  active = null

  for (const id of intervals) clearInterval(id)
  for (const id of timeouts) clearTimeout(id)

  for (const n of nodes) {
    try { (n as AudioScheduledSourceNode).stop?.() } catch { /* ignore */ }
    try { n.disconnect() } catch { /* ignore */ }
  }
  try { gain.disconnect() } catch { /* ignore */ }
  try { ctx.close() } catch { /* ignore */ }
}

function start(type: NoiseType) {
  if (type === 'none') {
    stop()
    return
  }
  // 同类型重复点击 → 停止（开关语义）
  if (current.value === type && active) {
    stop()
    return
  }
  stop()

  const ctx = new AudioContext()
  const gain = ctx.createGain()
  gain.gain.value = volume.value
  gain.connect(ctx.destination)

  const nodes: AudioNode[] = []
  const intervals: number[] = []
  const timeouts: number[] = []

  if (type === 'rain') {
    // 雨声：白噪音 + 低通
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx)
    noise.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3000
    noise.connect(lp).connect(gain)
    noise.start()
    nodes.push(noise, lp)
  } else if (type === 'cafe') {
    // 咖啡馆：粉红噪音 + 中频带通
    const noise = ctx.createBufferSource()
    noise.buffer = createPinkNoiseBuffer(ctx)
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 400
    bp.Q.value = 0.6
    noise.connect(bp).connect(gain)
    noise.start()
    nodes.push(noise, bp)
  } else if (type === 'keyboard') {
    // 键盘：白噪音高通（击键）+ 粉红噪音低通（底噪）
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx)
    noise.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2500
    noise.connect(hp).connect(gain)
    noise.start()

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    const noise2 = ctx.createBufferSource()
    noise2.buffer = createPinkNoiseBuffer(ctx)
    noise2.loop = true
    noise2.connect(lp).connect(gain)
    noise2.start()
    nodes.push(noise, hp, noise2, lp)
  } else if (type === 'forest') {
    // 风声：粉红噪音低通
    const noise = ctx.createBufferSource()
    noise.buffer = createPinkNoiseBuffer(ctx)
    noise.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    noise.connect(lp).connect(gain)
    noise.start()
    nodes.push(noise, lp)

    // 鸟鸣：高频正弦 + 颤音，每 3~5s 随机出现一次
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1800
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0
    osc.connect(oscGain).connect(gain)
    osc.start()
    // 关键修复：振荡器必须进入 nodes，否则 stop() 时不会被停止/断开
    nodes.push(osc, oscGain)

    const chirp = () => {
      const t = ctx.currentTime
      osc.frequency.cancelScheduledValues(t)
      osc.frequency.setValueAtTime(1500 + Math.random() * 1000, t)
      osc.frequency.linearRampToValueAtTime(2200 + Math.random() * 800, t + 0.1)
      osc.frequency.linearRampToValueAtTime(1500 + Math.random() * 1000, t + 0.3)
      oscGain.gain.cancelScheduledValues(t)
      oscGain.gain.setValueAtTime(0, t)
      oscGain.gain.linearRampToValueAtTime(0.08, t + 0.05)
      oscGain.gain.linearRampToValueAtTime(0, t + 0.3)
    }
    // 关键修复：定时器 id 必须进入 intervals，否则永不 clearInterval
    const id = window.setInterval(() => {
      chirp()
    }, 3000 + Math.random() * 2000)
    intervals.push(id)

    // 首声延迟一下，避免刚开启就有鸟叫
    timeouts.push(window.setTimeout(chirp, 1200))
  }

  active = { ctx, nodes, gain, intervals, timeouts }
  current.value = type
}

function stop() {
  stopActive()
  current.value = 'none'
}

function setVolume(v: number) {
  volume.value = Math.max(0, Math.min(1, v))
  if (active) active.gain.gain.value = volume.value
}

/** 应用卸载 / 组件销毁时彻底释放音频资源 */
function dispose() {
  stop()
}

export function useWhiteNoise() {
  // 组合式函数若在组件作用域内调用，自动随作用域销毁
  onScopeDispose(() => {
    /* 单例音频不随单个组件销毁，仅由 dispose() 显式释放 */
  })
  return { current, volume, playing, start, stop, setVolume, dispose }
}
