import type { ArmyMove, RecognitionOfWar } from '../internal/gamelogic/gamedata.js';
import type { GameState, PlayingState } from '../internal/gamelogic/gamestate.js';
import { handleMove, MoveOutcome } from '../internal/gamelogic/move.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import { handleWar, WarOutcome } from '../internal/gamelogic/war.js';
import type { Acktype } from '../internal/pubsub/consume.js';
import { WarRecognitionsPrefix } from '../internal/routing/routing.js';

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
    return 'Ack';
  };
}

export function handlerMove(
  gs: GameState,
  publish: (routingKey: string, value: RecognitionOfWar) => Promise<void>,
): (move: ArmyMove) => Promise<Acktype> {
  return async (move: ArmyMove) => {
    const outcome = handleMove(gs, move);
    process.stdout.write('> ');
    switch (outcome) {
      case MoveOutcome.Safe:
        return 'Ack';
      case MoveOutcome.MakeWar: {
        await publish(`${WarRecognitionsPrefix}.${gs.getUsername()}`, {
          attacker: move.player,
          defender: gs.getPlayerSnap(),
        } satisfies RecognitionOfWar);
        return 'NackRequeue';
      }
      default:
        return 'NackDiscard';
    }
  };
}

export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => Promise<Acktype> {
  return async (rw: RecognitionOfWar) => {
    const warResolution = handleWar(gs, rw);

    switch (warResolution.result) {
      case WarOutcome.NotInvolved:
        return 'NackRequeue';
      case WarOutcome.NoUnits:
        return 'NackDiscard';
      case WarOutcome.OpponentWon:
      case WarOutcome.YouWon:
      case WarOutcome.Draw:
        return 'Ack';
      default: {
        console.log('Error - Invalid war outcome');
        process.stdout.write('> ');
        return 'NackDiscard';
      }
    }
  };
}
