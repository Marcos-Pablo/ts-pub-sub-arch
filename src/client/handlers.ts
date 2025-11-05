import type { ConfirmChannel } from 'amqplib';
import type { ArmyMove, RecognitionOfWar } from '../internal/gamelogic/gamedata.js';
import type { GameState, PlayingState } from '../internal/gamelogic/gamestate.js';
import { handleMove, MoveOutcome } from '../internal/gamelogic/move.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import { handleWar, WarOutcome } from '../internal/gamelogic/war.js';
import type { Acktype } from '../internal/pubsub/consume.js';
import { ExchangePerilTopic, WarRecognitionsPrefix } from '../internal/routing/routing.js';
import { publishJSON } from '../internal/pubsub/publish.js';

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
    return 'Ack';
  };
}

export function handlerMove(gs: GameState, channel: ConfirmChannel): (move: ArmyMove) => Promise<Acktype> {
  return async (move: ArmyMove) => {
    try {
      const outcome = handleMove(gs, move);

      switch (outcome) {
        case MoveOutcome.Safe:
          return 'Ack';
        case MoveOutcome.MakeWar: {
          const recognition: RecognitionOfWar = {
            attacker: move.player,
            defender: gs.getPlayerSnap(),
          };

          try {
            await publishJSON(channel, ExchangePerilTopic, `${WarRecognitionsPrefix}.${gs.getUsername()}`, recognition);
            return 'Ack';
          } catch (error) {
            console.log('Error publishing war recognition:', error);
            return 'NackRequeue';
          }
        }
        default:
          return 'NackDiscard';
      }
    } finally {
      process.stdout.write('> ');
    }
  };
}

export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => Promise<Acktype> {
  return async (rw: RecognitionOfWar) => {
    try {
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
          const unreachable: never = warResolution;
          console.log('Unexpected war resolution: ', unreachable);
          return 'NackDiscard';
        }
      }
    } finally {
      process.stdout.write('> ');
    }
  };
}
