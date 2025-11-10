import Redis from 'ioredis';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

const globalForDb = globalThis as unknown as {
	redisClient: Redis | undefined;
};

const getClient = () => {
	if (building) {
		throw new Error('Cannot access database during build');
	}

	if (!globalForDb.redisClient) {
		globalForDb.redisClient = new Redis(env.REDIS_URL);
	}

	return globalForDb.redisClient;
};

export const redisClient = new Proxy({} as Redis, {
	get: (_, prop) => {
		const client = getClient();
		return client[prop as keyof Redis];
	}
});
