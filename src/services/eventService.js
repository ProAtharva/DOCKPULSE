import Redis from 'ioredis';
import { config } from '../config/env.js';

/**
 * Event flow (Redis Pub/Sub):
 *
 * 1. `simulationService` calls `publishEvent(DOMAIN_EVENT, payload)` when the world changes.
 * 2. Events are serialized to JSON and published to `REDIS_EVENTS_CHANNEL`.
 * 3. A dedicated subscriber client (`subscriber` below) receives messages on that channel.
 * 4. `socketHandler` / server wiring passes each message to Socket.io → all connected
 *    clients receive the same event stream in real time.
 *
 * This pattern keeps simulation logic decoupled from transport: you could add more
 * subscribers (logging, other services) without changing the simulation loop.
 */

let publisher = null;
let subscriber = null;

const REDIS_READY_MS = 10_000;

/**
 * @typedef {'SHIP_CREATED' | 'SHIP_APPROACHING' | 'SHIP_ARRIVED' | 'BERTH_ASSIGNED' | 'QUEUE_UPDATED'} PortEventType
 */

/**
 * Waits until the ioredis client is connected (or throws if Redis never becomes ready).
 * @param {import('ioredis').Redis} client
 */
function waitUntilReady(client) {
  return new Promise((resolve, reject) => {
    if (client.status === 'ready') {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      client.removeListener('ready', onReady);
      reject(
        new Error(
          `Redis not reachable within ${REDIS_READY_MS}ms (${config.redisUrl}). Start Redis or set REDIS_URL.`,
        ),
      );
    }, REDIS_READY_MS);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    client.once('ready', onReady);
  });
}

/**
 * @param {PortEventType} type
 * @param {object} payload
 */
export async function publishEvent(type, payload) {
  if (!publisher) {
    await connectPublisher();
  }
  const message = JSON.stringify({
    type,
    payload,
    ts: Date.now(),
  });
  await publisher.publish(config.redisEventsChannel, message);
}

export function getEventsChannel() {
  return config.redisEventsChannel;
}

async function connectPublisher() {
  publisher = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
  publisher.on('error', (err) => {
    console.error('[eventService] publisher Redis error:', err.message);
  });
  await waitUntilReady(publisher);
}

/**
 * Subscribe to simulation events. Invokes `onMessage(parsed)` for each event.
 * Parsed shape: `{ type, payload, ts }`.
 *
 * @param {(msg: { type: string, payload: object, ts: number }) => void} onMessage
 */
export async function subscribeToEvents(onMessage) {
  if (subscriber) {
    await disconnectSubscriber();
  }
  subscriber = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  subscriber.on('error', (err) => {
    console.error('[eventService] subscriber Redis error:', err.message);
  });

  await waitUntilReady(subscriber);
  await subscriber.subscribe(config.redisEventsChannel);

  subscriber.on('message', (channel, raw) => {
    if (channel !== config.redisEventsChannel) return;
    try {
      const parsed = JSON.parse(raw);
      onMessage(parsed);
    } catch (e) {
      console.error('[eventService] bad message:', e.message);
    }
  });
}

export async function disconnectRedis() {
  await disconnectSubscriber();
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

async function disconnectSubscriber() {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}
