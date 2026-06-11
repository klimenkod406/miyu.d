import assert from 'node:assert/strict'
import { getPresenceSubtitle, getPresenceTitle } from './friendPresenceView.mjs'

const presence = {
  isOnline: true,
  listeningTo: {
    type: 'playlist',
    track: {
      title: 'Midnight City',
      artist: { username: 'M83' },
      album: { title: 'Hurry Up' },
    },
    context: { type: 'playlist', title: 'Ночной драйв' },
  },
}

assert.equal(getPresenceTitle(presence), 'Midnight City')
assert.equal(getPresenceSubtitle(presence), 'M83 • Из плейлиста: Ночной драйв')
assert.equal(getPresenceTitle({ isOnline: true, listeningTo: null }), 'Сейчас ничего не слушает')
assert.equal(getPresenceTitle({ isOnline: false, listeningTo: null }), 'Не в сети')
assert.equal(getPresenceSubtitle({ isOnline: true, listeningTo: { type: 'album', track: { title: 'Song', artist: { username: 'Artist' } }, context: { type: 'album', title: 'Album' } } }), 'Artist • Из альбома: Album')

console.log('friendPresenceView tests passed')
