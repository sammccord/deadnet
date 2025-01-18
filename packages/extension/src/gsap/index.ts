import { gsap } from 'gsap';
import Draggable from 'gsap/dist/Draggable';
import * as PIXI from 'pixi.js';
import { PixiPlugin } from './PixiPlugin';

gsap.registerPlugin(Draggable);
gsap.registerPlugin(PixiPlugin);

PixiPlugin.registerPIXI(PIXI);

export { gsap, Draggable };
