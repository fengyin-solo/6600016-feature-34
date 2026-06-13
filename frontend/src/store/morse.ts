import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { MORSE_TABLE, REVERSE_TABLE, textToMorse, morseToText } from '../utils/morse-code'
import type { TrainMode, HistoryEntry } from '../types'

const PINNED_CHARS_KEY = 'morse_pinned_chars'
const ALL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function loadPinnedChars(): string[] {
  try {
    const saved = localStorage.getItem(PINNED_CHARS_KEY)
    if (saved) {
      const arr = JSON.parse(saved)
      return Array.isArray(arr) ? arr.filter(c => ALL_CHARS.includes(c)) : []
    }
  } catch (e) {}
  return []
}

export const useMorseStore = defineStore('morse', () => {
  const inputText = ref('')
  const morseOutput = ref('')
  const decodedText = ref('')
  const wpm = ref(15)
  const frequency = ref(700)
  const volume = ref(0.6)
  const trainMode = ref<TrainMode>('charToCode')
  const history = ref<HistoryEntry[]>([])
  const quizChar = ref('')
  const userAnswer = ref('')
  const score = ref({ correct: 0, total: 0 })
  const isPlaying = ref(false)
  const pinnedChars = ref<string[]>(loadPinnedChars())
  let audioCtx: AudioContext | null = null
  let currentOscillator: OscillatorNode | null = null

  watch(pinnedChars, (val) => {
    localStorage.setItem(PINNED_CHARS_KEY, JSON.stringify(val))
  }, { deep: true })

  const dotDuration = computed(() => 1200 / wpm.value)

  function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function playTone(duration: number): Promise<void> {
    return new Promise(resolve => {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency.value
      gain.gain.value = volume.value
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentOscillator = osc
      setTimeout(() => { osc.stop(); currentOscillator = null; resolve() }, duration)
    })
  }

  async function playMorse(morse: string) {
    isPlaying.value = true
    const dd = dotDuration.value
    for (const token of morse.split(' ')) {
      if (token === '/') { await sleep(dd * 7); continue }
      for (const sym of token) {
        await playTone(sym === '.' ? dd : dd * 3)
        await sleep(dd)
      }
      await sleep(dd * 2)
    }
    isPlaying.value = false
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  function encode() {
    morseOutput.value = textToMorse(inputText.value)
  }

  function decode() {
    decodedText.value = morseToText(inputText.value)
  }

  function togglePin(char: string) {
    const idx = pinnedChars.value.indexOf(char)
    if (idx >= 0) {
      pinnedChars.value.splice(idx, 1)
    } else {
      pinnedChars.value.push(char)
    }
  }

  function isPinned(char: string): boolean {
    return pinnedChars.value.includes(char)
  }

  function generateQuiz() {
    const pool = pinnedChars.value.length > 0 ? pinnedChars.value.join('') : ALL_CHARS
    quizChar.value = pool[Math.floor(Math.random() * pool.length)]
    userAnswer.value = ''
  }

  function checkAnswer() {
    const correct = userAnswer.value.trim() === MORSE_TABLE[quizChar.value]
    score.value.total++
    if (correct) score.value.correct++
    history.value.unshift({
      id: Date.now(), input: quizChar.value, output: userAnswer.value,
      correct, timestamp: Date.now()
    })
    generateQuiz()
  }

  function resetScore() {
    score.value = { correct: 0, total: 0 }
    history.value = []
  }

  return {
    inputText, morseOutput, decodedText, wpm, frequency, volume,
    trainMode, history, quizChar, userAnswer, score, isPlaying,
    pinnedChars, dotDuration, encode, decode, playMorse, playTone,
    generateQuiz, checkAnswer, resetScore, togglePin, isPinned
  }
})
