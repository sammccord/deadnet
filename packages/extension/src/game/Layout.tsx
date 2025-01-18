import { GameMode } from '@deadnet/bebop/lib/bebop';
import type { JSXElement } from 'solid-js';

export function Layout(props: { children: JSXElement }) {
  return <div class="md:grid grid-cols-12 gap-1 p-1">{props.children}</div>;
}
