import amqp from 'amqplib';
import { clientWelcome } from '../internal/gamelogic/gamelogic.js';
import { declareAndBind } from '../internal/pubsub/consume.js';
import { ExchangePerilDirect, PauseKey } from '../internal/routing/routing.js';

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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
