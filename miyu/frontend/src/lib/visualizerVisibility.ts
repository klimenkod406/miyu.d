// Tracks whether the main AudioVisualizer is currently mounted AND on screen.
// Used so the MiniAudioVisualizer in the sidebar can show only when the main one isn't.

let visible = false
const subs = new Set<(v: boolean) => void>()

export function setMainVisualizerVisible(v: boolean) {
  if (visible !== v) {
    visible = v
    subs.forEach(s => s(v))
  }
}

export function subscribeMainVisualizerVisible(cb: (v: boolean) => void) {
  subs.add(cb)
  cb(visible)
  return () => {
    subs.delete(cb)
  }
}
