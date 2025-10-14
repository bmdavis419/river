import type { CreateRiverRouter, CreateRiverStream, RiverStreamBuilderInit } from './types.js';

const createRiverStream: CreateRiverStream = () => {
	return {
		input: (inputSchema) => {
			return {
				runner: (runnerFn) => {
					return {
						inputSchema,
						runner: runnerFn as any
					};
				}
			};
		}
	};
};

const createRiverRouter: CreateRiverRouter = (streams) => streams as any;

export const RIVER_STREAMS = { createRiverStream, createRiverRouter };
