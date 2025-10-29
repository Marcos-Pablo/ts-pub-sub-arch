import amqp from 'amqplib';

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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
