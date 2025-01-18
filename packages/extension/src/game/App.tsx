import ninetyEight from '98.css?inline';
import type { GreeterClient } from '@deadnet/bebop/lib/bebop';
import { MultiProvider } from '@solid-primitives/context';
import { DeckWindow } from './DeckWindow';
import { ECSProvider } from './ECSContext';
import { GameConfigProvider } from './GameConfigContext';
import { GameStateProvider } from './GameStateContext';
import { GameWindow } from './GameWindow';
import { Layout } from './Layout';
import { ModeProvider } from './ModeContext';
import { PlayerProvider } from './PlayerContext';
import styles from './styles.css?inline';

export function App(_props: { client?: GreeterClient }) {
  return (
    <MultiProvider
      values={[
        PlayerProvider,
        GameConfigProvider,
        GameStateProvider,
        ECSProvider,
        ModeProvider,
      ]}
    >
      <style type="text/css">{ninetyEight.toString()}</style>
      <style type="text/css">{styles.toString()}</style>
      <Layout>
        <GameWindow />
        <DeckWindow />
      </Layout>
    </MultiProvider>
  );
}
