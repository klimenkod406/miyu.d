// Shared AnalyserNode singleton.
// Player.tsx creates the AnalyserNode and registers it here.
// Any visualizer component can subscribe and pull frequency data via getAnalyser().

let analyser: AnalyserNode | null = null
const listeners = new Set<(a: AnalyserNode | null) => void>()

export function setAnalyser(a: AnalyserNode | null) {
  analyser = a
  listeners.forEach(fn => fn(a))
}

export function getAnalyser(): AnalyserNode | null {
  return analyser
}

export function subscribeAnalyser(fn: (a: AnalyserNode | null) => void): () => void {
  listeners.add(fn)
  fn(analyser)
  return () => {
    listeners.delete(fn)
  }
}
