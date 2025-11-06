import amqp, { type ConfirmChannel } from 'amqplib';
import {
  clientWelcome,
  commandStatus,
  getInput,
  getMaliciousLog,
  printClientHelp,
  printQuit,
} from '../internal/gamelogic/gamelogic.js';
import { subscribeJSON } from '../internal/pubsub/consume.js';
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
  WarRecognitionsPrefix,
} from '../internal/routing/routing.js';
import { GameState } from '../internal/gamelogic/gamestate.js';
import { commandSpawn } from '../internal/gamelogic/spawn.js';
import { commandMove } from '../internal/gamelogic/move.js';
import { handlerMove, handlerPause, handlerWar } from './handlers.js';
import { publishJSON, publishMsgPack } from '../internal/pubsub/publish.js';
import type { GameLog } from '../internal/gamelogic/logs.js';

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
        console.error('Error closing RabbitMQ connection:', err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();
  const gameState = new GameState(username);
  const channel = await connection.createConfirmChannel();

  await Promise.all([
    subscribeJSON(
      connection,
      ExchangePerilDirect,
      `${PauseKey}.${username}`,
      PauseKey,
      'transient',
      handlerPause(gameState),
    ),
    subscribeJSON(
      connection,
      ExchangePerilTopic,
      `${ArmyMovesPrefix}.${username}`,
      `${ArmyMovesPrefix}.*`,
      'transient',
      handlerMove(gameState, channel),
    ),
    subscribeJSON(
      connection,
      ExchangePerilTopic,
      'war',
      `${WarRecognitionsPrefix}.*`,
      'durable',
      handlerWar(gameState, channel),
    ),
  ]);

  while (true) {
    const input = await getInput();

    if (input.length === 0) continue;

    const command = input[0];
    switch (command) {
      case 'spawn': {
        try {
          commandSpawn(gameState, input);
        } catch (error) {
          console.error(error instanceof Error ? error.message : 'Error while trying to spawn unit');
        }
        break;
      }
      case 'move': {
        try {
          const move = commandMove(gameState, input);
          await publishJSON(channel, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, move);
        } catch (error) {
          console.error(error instanceof Error ? error.message : 'Error while trying to move unit');
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
        if (!input[1] || Number.isNaN(input[1])) {
          console.log('usage: spam <number>');
          continue;
        }

        const spamNumber = parseInt(input[1]);
        for (let i = 0; i < spamNumber; i++) {
          try {
            const log = getMaliciousLog();
            publishGameLog(channel, gameState.getUsername(), log);
          } catch (error) {
            console.error('Error publishing spam message:', error);
          }
        }
        console.log(`Published ${spamNumber} malicious logs`);
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

export async function publishGameLog(ch: ConfirmChannel, username: string, message: string) {
  const gameLog: GameLog = {
    username: username,
    message: message,
    currentTime: new Date(),
  };

  await publishMsgPack(ch, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
