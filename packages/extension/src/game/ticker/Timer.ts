import type { IEntity } from '@deadnet/bebop/lib/bebop';

export class Timer {
  timers: Record<number, number> = {};
  getSpeed: (entity: IEntity) => number;

  constructor(getSpeed: Timer['getSpeed']) {
    this.getSpeed = getSpeed;
  }

  remove(entity: IEntity) {
    delete this.timers[entity.id!];
  }

  update(entity: IEntity, delta: number): number | undefined {
    const id = entity.id!;
    let progress = this.timers[id];
    if (progress === undefined) this.timers[id] = progress = 0;
    const newProgress = progress + delta;
    const speed = this.getSpeed(entity) || newProgress;
    if (newProgress < speed) {
      this.timers[id] = newProgress;
      return;
    }
    this.timers[id] = newProgress % speed;
    return Math.floor(newProgress / speed);
  }
}
