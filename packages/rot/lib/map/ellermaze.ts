import RNG from '../rng'
import Map, { CreateCallback } from './map'

type List = number[]

/**
 * Join lists with "i" and "i+1"
 */
function addToList(i: number, L: List, R: List) {
  //@ts-ignore
  R[L[i + 1]] = R[i]
  //@ts-ignore
  L[R[i]] = L[i + 1]
  R[i] = i + 1
  L[i + 1] = i
}

/**
 * Remove "i" from its list
 */
function removeFromList(i: number, L: List, R: List) {
  //@ts-ignore
  R[L[i]] = R[i]
  //@ts-ignore
  L[R[i]] = L[i]
  R[i] = i
  L[i] = i
}

/**
 * Maze generator - Eller's algorithm
 * See http://homepages.cwi.nl/~tromp/maze.html for explanation
 */
export default class EllerMaze extends Map {
  create(callback: CreateCallback) {
    let map = this._fillMap(1)
    let w = Math.ceil((this._width - 2) / 2)

    let rand = 9 / 24

    let L: List = []
    let R: List = []

    for (let i = 0; i < w; i++) {
      L.push(i)
      R.push(i)
    }
    L.push(w - 1) /* fake stop-block at the right side */

    let j
    for (j = 1; j + 3 < this._height; j += 2) {
      /* one row */
      for (let i = 0; i < w; i++) {
        /* cell coords (will be always empty) */
        let x = 2 * i + 1
        let y = j
        //@ts-ignore
        map[x][y] = 0

        /* right connection */
        if (i != L[i + 1] && RNG.getUniform() > rand) {
          addToList(i, L, R)
          //@ts-ignore
          map[x + 1][y] = 0
        }

        /* bottom connection */
        if (i != L[i] && RNG.getUniform() > rand) {
          /* remove connection */
          removeFromList(i, L, R)
        } else {
          /* create connection */
          //@ts-ignore
          map[x][y + 1] = 0
        }
      }
    }

    /* last row */
    for (let i = 0; i < w; i++) {
      /* cell coords (will be always empty) */
      let x = 2 * i + 1
      let y = j
      //@ts-ignore
      map[x][y] = 0

      /* right connection */
      if (i != L[i + 1] && (i == L[i] || RNG.getUniform() > rand)) {
        /* dig right also if the cell is separated, so it gets connected to the rest of maze */
        addToList(i, L, R)
        //@ts-ignore
        map[x + 1][y] = 0
      }

      removeFromList(i, L, R)
    }

    for (let i = 0; i < this._width; i++) {
      for (let j = 0; j < this._height; j++) {
        //@ts-ignore
        callback(i, j, map[i][j])
      }
    }

    return this
  }
}
