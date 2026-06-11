export type RGB = [number, number, number]
export type Palette = [RGB, RGB, RGB]

// Idle (no track playing) — clean whites
export const IDLE_PALETTE: Palette = [
  [255, 255, 255],
  [235, 240, 250],
  [205, 215, 235],
]

// Mood-driven gradients per genre — soft, readable, and distinct
export const PALETTES: Record<string, Palette> = {
  rock: [[255, 118, 92], [238, 92, 74], [255, 178, 92]],
  metal: [[180, 72, 92], [92, 74, 110], [42, 48, 66]],
  pop: [[255, 142, 202], [218, 132, 255], [124, 158, 255]],
  electronic: [[92, 224, 238], [94, 154, 255], [176, 132, 255]],
  hiphop: [[255, 196, 92], [238, 126, 88], [214, 82, 124]],
  rnb: [[214, 124, 204], [158, 108, 214], [88, 88, 168]],
  jazz: [[255, 204, 122], [198, 132, 92], [96, 88, 158]],
  blues: [[92, 166, 232], [72, 112, 198], [42, 58, 128]],
  classical: [[252, 250, 238], [178, 216, 244], [126, 154, 226]],
  ambient: [[138, 232, 232], [152, 184, 242], [210, 164, 232]],
  folk: [[246, 196, 126], [204, 148, 92], [126, 92, 62]],
  reggae: [[244, 212, 92], [92, 196, 122], [232, 92, 92]],
  country: [[244, 184, 102], [218, 128, 82], [150, 86, 66]],
  punk: [[238, 92, 144], [204, 72, 116], [92, 72, 154]],
  default: [[172, 132, 255], [238, 132, 214], [255, 188, 126]],
}

export function paletteForGenre(genre?: string | null): Palette {
  if (!genre) return PALETTES.default
  const k = genre.toLowerCase()
  if (k.includes('панк') || k.includes('punk')) return PALETTES.punk
  if (k.includes('рок') || k.includes('rock')) return PALETTES.rock
  if (k.includes('метал') || k.includes('metal')) return PALETTES.metal
  if (k.includes('поп') || k.includes('pop')) return PALETTES.pop
  if (k.includes('электр') || k.includes('elect') || k.includes('dance') || k.includes('edm') || k.includes('house') || k.includes('techno') || k.includes('trance')) return PALETTES.electronic
  if (k.includes('хип') || k.includes('hip') || k.includes('rap') || k.includes('рэп')) return PALETTES.hiphop
  if (k.includes('r&b') || k.includes('rnb') || k.includes('соул') || k.includes('soul')) return PALETTES.rnb
  if (k.includes('lo-fi') || k.includes('lofi') || k.includes('лоу')) return PALETTES.ambient
  if (k.includes('джаз') || k.includes('jazz')) return PALETTES.jazz
  if (k.includes('блюз') || k.includes('blues')) return PALETTES.blues
  if (k.includes('класс') || k.includes('class')) return PALETTES.classical
  if (k.includes('эмбиент') || k.includes('ambient') || k.includes('chill')) return PALETTES.ambient
  if (k.includes('фолк') || k.includes('folk') || k.includes('акуст') || k.includes('acoust')) return PALETTES.folk
  if (k.includes('регги') || k.includes('reggae')) return PALETTES.reggae
  if (k.includes('кантри') || k.includes('country')) return PALETTES.country
  return PALETTES.default
}
