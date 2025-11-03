import type { ArmyMove } from '../internal/gamelogic/gamedata.js';
import type { GameState, PlayingState } from '../internal/gamelogic/gamestate.js';
import { handleMove, MoveOutcome } from '../internal/gamelogic/move.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import type { Acktype } from '../internal/pubsub/consume.js';

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
    return 'Ack';
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => Acktype {
  return (move: ArmyMove) => {
    const outcome = handleMove(gs, move);
    console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
    process.stdout.write('> ');
    switch (outcome) {
      case MoveOutcome.Safe:
      case MoveOutcome.MakeWar:
        return 'Ack';
      default:
        return 'NackDiscard';
    }
  };
}
