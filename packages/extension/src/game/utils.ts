import type { IGeometry, IPoint } from '@deadnet/bebop/lib/bebop';
import type DiscreteShadowcasting from '@deadnet/rot/lib/fov/discrete-shadowcasting';
import type PreciseShadowcasting from '@deadnet/rot/lib/fov/precise-shadowcasting';
import type RecursiveShadowcasting from '@deadnet/rot/lib/fov/recursive-shadowcasting';
import type RNG from '@deadnet/rot/lib/rng';
import { clamp } from '@deadnet/rot/lib/util';
import { Container, FederatedPointerEvent, Point } from 'pixi-unsafe';

export const center = new Point(0.5, 0.5);

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function wrapContext<T>(
  ctxFn: () => T | undefined,
  name: string,
): () => T {
  return () => {
    const ctx = ctxFn();
    if (ctx === undefined) {
      throw new Error(`use${name} must be used within a ${name}.Provider`);
    }
    return ctx;
  };
}

export function positionFromIndex(
  index: number,
  width: number,
  height: number,
  depth: number,
): IPoint {
  if (index < 0 || index >= width * height * depth) {
    throw new Error('Index out of bounds');
  }

  return {
    x: index % width,
    y: Math.floor((index / width) % height),
    z: Math.floor(index / (width * height)),
  };
}

export function indexFromPosition(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
): number {
  // Check if coordinates are within bounds
  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
    return -1;
  }

  // Calculate the index using the formula:
  // index = x + (y * width) + (z * width * height)
  return x + y * width + z * width * height;
}

export function rotateArray<T>(
  array: T[],
  width: number,
  height: number,
  depth: number,
): T[] {
  // Create new array of same size
  const rotated = new Array<T>(array.length);

  // Iterate through all coordinates
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Get original index
        const originalIndex = indexFromPosition(x, y, z, width, height, depth);
        if (originalIndex === -1) continue;

        // Calculate rotated coordinates (90 degree rotation)
        const newX = height - 1 - y;
        const newY = x;
        const newZ = z;

        // Get new rotated index
        const newIndex = indexFromPosition(
          newX,
          newY,
          newZ,
          height, // Width and height are swapped after rotation
          width,
          depth,
        );
        if (newIndex === -1) continue;

        // Copy value to new position
        rotated[newIndex] = array[originalIndex];
      }
    }
  }

  return rotated;
}

export function collectGeometryPositions(tile: IPoint, geometry: IGeometry) {
  const { topology, dimensions } = geometry;
  const centerX = Math.floor(dimensions.x / 2),
    centerY = Math.floor(dimensions.y / 2);
  const parts: IPoint[] = [];
  for (let i = 0; i < topology.length; i++) {
    const value = topology[i];
    if (!value) continue;
    // get tile x/y from index
    const position = positionFromIndex(
      i,
      dimensions.x,
      dimensions.y,
      dimensions.z,
    );
    // get tile position offset from center piece
    parts.push({
      x: tile.x - (centerX - position.x),
      y: tile.y - (centerY - position.y),
      z: tile.z,
    });
  }
  return parts;
}

const maxUint32 = 4294967295;

export function clampUint32(value: number, min?: number, max?: number) {
  return clamp(value, min || 0, max || maxUint32);
}

export const uniformMultipleOf = (
  rng: typeof RNG,
  mof: number,
  min: number,
  max: number,
) => Math.round((rng.getUniform() * (max - min) + min) / mof) * mof;

export function tryFindFirstPositionMatching(
  fov: PreciseShadowcasting | RecursiveShadowcasting | DiscreteShadowcasting,
  x: number,
  y: number,
  z: number,
  radius: number,
  cb: (x: number, y: number, r: number, visibility: number) => boolean,
): IPoint | undefined {
  let position: IPoint;
  try {
    fov.compute(x, y, radius, (x, y, r, visibility) => {
      if (cb(x, y, r, visibility)) throw { x, y, z };
    });
  } catch (e) {
    if (e && e instanceof Error === false) position = e as IPoint;
  }
  //@ts-expect-error this value should exist
  return position;
}

export function toLocalTopology<
  SkipFalsy extends boolean = true,
  Points = SkipFalsy extends true ? (IPoint | undefined)[] : IPoint[],
>(point: IPoint, geometry: IGeometry, skipFalsy: SkipFalsy): Points {
  const points = [];
  const cx = Math.floor(geometry.dimensions.x / 2),
    cy = Math.floor(geometry.dimensions.y / 2);
  for (let i = 0; i < geometry.topology.length; i++) {
    const value = geometry.topology[i];
    if (skipFalsy && !value) {
      points.push(undefined);
      continue;
    }
    const localPosition = positionFromIndex(
      i,
      geometry.dimensions.x,
      geometry.dimensions.y,
      geometry.dimensions.z,
    );
    points.push({
      x: point.x - (cx - localPosition.x),
      y: point.y - (cy - localPosition.y),
      z: point.z,
    });
  }

  return points as Points;
}

export function testPosition(
  fov: PreciseShadowcasting | RecursiveShadowcasting | DiscreteShadowcasting,
  x: number,
  y: number,
  radius: number,
  cb: (x: number, y: number, r: number, visibility: number) => boolean,
): boolean {
  let matching = true;
  try {
    fov.compute(x, y, radius, (x, y, r, visibility) => {
      if (!cb(x, y, r, visibility)) {
        matching = false;
        throw matching;
      }
    });
  } catch (e) {
    console.warn(e);
  }
  return matching;
}
