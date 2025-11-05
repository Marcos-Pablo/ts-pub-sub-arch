import type { ConfirmChannel } from 'amqplib';
import { encode } from '@msgpack/msgpack';

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const stringifiedJson = JSON.stringify(value);

  if (stringifiedJson === undefined) {
    throw new Error('Value is not JSON-serializable');
  }

  const content = Buffer.from(stringifiedJson, 'utf8');

  return new Promise((resolve, reject) => {
    ch.publish(exchange, routingKey, content, { contentType: 'application/json' }, (err) => {
      if (err !== null) {
        reject(new Error('Message was NACKed by the broker'));
      }
      resolve();
    });
  });
}

export async function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const content = Buffer.from(encode(value));

  if (!content) {
    throw new Error('Value is not messagepack-serializable');
  }

  return new Promise((resolve, reject) => {
    ch.publish(exchange, routingKey, content, { contentType: 'application/x-msgpack' }, (err) => {
      if (err !== null) {
        reject(new Error('Message was NACKed by the broker'));
      }
      resolve();
    });
  });
}
