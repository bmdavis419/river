import type { CreateRiverStream } from './types';

export const createRiverStream: CreateRiverStream = () => ({
	input: (inputSchema) => ({
		provider: (provider) => ({
			runner: (runnerFn) => ({
				inputSchema,
				provider,
				runner: runnerFn,
				adapterRequest: null
			})
		})
	})
});
