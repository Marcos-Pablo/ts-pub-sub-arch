import amqp from 'amqplib';
import { publishJSON } from '../internal/pubsub/publish.js';
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from '../internal/routing/routing.js';
import type { PlayingState } from '../internal/gamelogic/gamestate.js';
import { getInput, printServerHelp } from '../internal/gamelogic/gamelogic.js';
import { subscribeMsgPack } from '../internal/pubsub/consume.js';
import { handlerLog } from './handlers.js';

async function main() {
  console.log('Starting Peril server...');
  const connectionString = 'amqp://guest:guest@localhost:5672/';
  const connection = await amqp.connect(connectionString);
  console.log('Peril game server connected with RabbitMQ!');

  ['SIGINT', 'SIGTERM'].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await connection.close();
        console.log('RabbitMQ connection closed.');
      } catch (err) {
        console.error('Error closing RabbitMQ connection:', err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const [directChannel] = await Promise.all([
    connection.createConfirmChannel(),
    subscribeMsgPack(connection, ExchangePerilTopic, GameLogSlug, `${GameLogSlug}.*`, 'durable', handlerLog()),
  ]);

  printServerHelp();

  while (true) {
    const input = await getInput();

    if (input.length === 0) continue;

    const command = input[0];
    switch (command) {
      case 'pause': {
        console.log('Sending pause message...');
        try {
          await publishJSON(directChannel, ExchangePerilDirect, PauseKey, { isPaused: true } satisfies PlayingState);
        } catch (error) {
          console.error(error instanceof Error ? error.message : 'Error while publishing pause message');
        }
        break;
      }
      case 'resume': {
        console.log('Sending resume message...');
        try {
          await publishJSON(directChannel, ExchangePerilDirect, PauseKey, { isPaused: false } satisfies PlayingState);
        } catch (error) {
          console.error(error instanceof Error ? error.message : 'Error while publishing resume message');
        }
        break;
      }
      case 'quit': {
        console.log('Goodbye!');
        process.exit(0);
      }
      default: {
        console.log('Unknown command');
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
