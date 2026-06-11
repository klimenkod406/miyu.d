import assert from 'node:assert/strict'
import { getSidebarContentOffset } from './sidebarVisualizerMotion.mjs'

assert.equal(getSidebarContentOffset(true), 0)
assert.equal(getSidebarContentOffset(false), -60)

console.log('sidebarVisualizerMotion tests passed')
