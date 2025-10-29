import type { ConfirmChannel } from 'amqplib';

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const json = JSON.stringify(value);

  if (json === undefined) {
    throw new Error('Value is not JSON-serializabe');
  }

  const content = Buffer.from(json, 'utf8');
  console.log('Publishing message');

  return new Promise((resolve, reject) => {
    ch.publish(exchange, routingKey, content, { contentType: 'application/json' }, (err) => {
      if (err !== null) {
        reject(new Error('Message was NACKed by the broker'));
      }
      resolve();
    });
  });
}
