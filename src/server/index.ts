import amqp from 'amqplib';
import { publishJSON } from '../internal/pubsub/publish.js';
import { ExchangePerilDirect, PauseKey } from '../internal/routing/routing.js';
import type { PlayingState } from '../internal/gamelogic/gamestate.js';

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
        console.log('Error closing RabbitMQ connection:', err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const channel = await connection.createConfirmChannel();

  try {
    await publishJSON(channel, ExchangePerilDirect, PauseKey, { isPaused: true } satisfies PlayingState);
  } catch (error) {
    console.log('Error publishing message:', error);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
