import amqp, { type Channel } from 'amqplib';
import { decode } from '@msgpack/msgpack';

type SimpleQueueType = 'durable' | 'transient';
export type Acktype = 'Ack' | 'NackRequeue' | 'NackDiscard';

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, {
    durable: queueType === 'durable',
    autoDelete: queueType === 'transient',
    exclusive: queueType === 'transient',
    arguments: {
      'x-dead-letter-exchange': 'peril_dlx',
    },
  });

  await channel.bindQueue(queue.queue, exchange, key);

  return [channel, queue];
}

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<Acktype> | Acktype,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [ch, queue] = await declareAndBind(conn, exchange, queueName, routingKey, simpleQueueType);
  await ch.prefetch(10);

  await ch.consume(queue.queue, async (message: amqp.ConsumeMessage | null) => {
    if (!message) return;

    let content: T;
    try {
      content = unmarshaller(message.content);
    } catch (error) {
      console.error('Could not unmarshal message:', error);
      return;
    }

    const acktype = await Promise.resolve(handler(content));
    switch (acktype) {
      case 'Ack': {
        ch.ack(message);
        break;
      }
      case 'NackRequeue': {
        ch.nack(message, false, true);
        break;
      }
      case 'NackDiscard':
      default: {
        ch.nack(message, false, false);
        break;
      }
    }
  });
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<Acktype> | Acktype,
): Promise<void> {
  subscribe(conn, exchange, queueName, key, queueType, handler, (data: Buffer) => JSON.parse(data.toString()));
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<Acktype> | Acktype,
): Promise<void> {
  subscribe(conn, exchange, queueName, key, queueType, handler, (data: Buffer) => decode(data) as T);
}
