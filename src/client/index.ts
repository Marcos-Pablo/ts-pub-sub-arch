import amqp from 'amqplib';
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from '../internal/gamelogic/gamelogic.js';
import { declareAndBind, subscribeJSON } from '../internal/pubsub/consume.js';
import { ExchangePerilDirect, PauseKey } from '../internal/routing/routing.js';
import { GameState, type PlayingState } from '../internal/gamelogic/gamestate.js';
import { commandSpawn } from '../internal/gamelogic/spawn.js';
import { commandMove } from '../internal/gamelogic/move.js';
import { handlerPause } from './handlers.js';

async function main() {
  console.log('Starting Peril client...');

  const connectionString = 'amqp://guest:guest@localhost:5672/';
  const connection = await amqp.connect(connectionString);

  console.log('Peril game client connected with RabbitMQ!');

  ['SIGINT', 'SIGTERM'].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await connection.close();
        console.log('RabbitMQ connection closed.');
      } catch (err) {
        console.log('Error closing RabbitMQ connection:', err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();

  const [channel, queue] = await declareAndBind(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    'transient',
  );

  const gameState = new GameState(username);
  subscribeJSON(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    'transient',
    handlerPause(gameState),
  );

  while (true) {
    const input = await getInput();

    if (input.length === 0) continue;

    const command = input[0];
    switch (command) {
      case 'spawn': {
        try {
          commandSpawn(gameState, input);
        } catch (error) {
          console.log(error instanceof Error ? error.message : 'Error while trying to spawn unit');
        }
        break;
      }
      case 'move': {
        try {
          commandMove(gameState, input);
        } catch (error) {
          console.log(error instanceof Error ? error.message : 'Error while trying to move unit');
        }
        break;
      }
      case 'status': {
        commandStatus(gameState);
        break;
      }
      case 'help': {
        printClientHelp();
        break;
      }
      case 'spam': {
        console.log('Spamming lot allowed yet!');
        break;
      }
      case 'quit': {
        printQuit();
        process.exit(0);
      }
      default: {
        console.log('Unknown command');
        continue;
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
