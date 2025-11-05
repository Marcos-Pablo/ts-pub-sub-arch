import { writeLog, type GameLog } from '../internal/gamelogic/logs.js';
import type { Acktype } from '../internal/pubsub/consume.js';

export function handlerLog(): (gl: GameLog) => Acktype {
  return (gl: GameLog) => {
    try {
      writeLog(gl);
      return 'Ack';
    } catch (err) {
      console.log('Error writing log:', err);
      return 'NackDiscard';
    } finally {
      process.stdout.write('> ');
    }
  };
}
