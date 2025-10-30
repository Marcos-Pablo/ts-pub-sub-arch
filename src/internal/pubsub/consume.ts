import amqp, { type Channel } from 'amqplib';

type SimpleQueueType = 'durable' | 'transient';

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
  });

  await channel.bindQueue(queue.queue, exchange, key);

  return [channel, queue];
}
