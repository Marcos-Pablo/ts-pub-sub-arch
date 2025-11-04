import amqp, { type Channel } from 'amqplib';

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

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<Acktype> | Acktype,
): Promise<void> {
  const [ch, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);

  await ch.consume(queue.queue, async (message: amqp.ConsumeMessage | null) => {
    if (!message) return;

    let content: T;
    try {
      content = JSON.parse(message.content.toString());
    } catch (error) {
      console.error('Could not unmarshal message:', error);
      return;
    }

    const acktype = await Promise.resolve(handler(content));
    if (acktype === 'Ack') {
      ch.ack(message);
      console.log('Ack');
    } else if (acktype === 'NackRequeue') {
      ch.nack(message, false, true);
      console.log('NackRequeue');
    } else {
      ch.nack(message, false, false);
      console.log('NackDiscard');
    }
  });
}
