import assert from 'node:assert/strict'
import { selectNextTrackIndex } from './playerNavigation.mjs'

assert.equal(selectNextTrackIndex({ queueLength: 3, currentIndex: 1, repeatMode: 'off', isShuffled: false }), 2)
assert.equal(selectNextTrackIndex({ queueLength: 3, currentIndex: 2, repeatMode: 'all', isShuffled: false }), 0)
assert.equal(selectNextTrackIndex({ queueLength: 3, currentIndex: 2, repeatMode: 'off', isShuffled: false }), null)
assert.equal(selectNextTrackIndex({ queueLength: 3, currentIndex: 1, repeatMode: 'one', isShuffled: false }), 1)
assert.equal(selectNextTrackIndex({ queueLength: 3, currentIndex: 1, repeatMode: 'off', isShuffled: true, random: () => 0.8 }), 2)
assert.equal(selectNextTrackIndex({ queueLength: 1, currentIndex: 0, repeatMode: 'off', isShuffled: true, random: () => 0 }), 0)

console.log('playerNavigation tests passed')
