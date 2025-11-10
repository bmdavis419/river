import { createFileRoute } from '@tanstack/react-router';
import { riverEndpointHandler } from '@davis7dotsh/river-adapter-tanstack';
import { myRiverRouter } from '@/lib/river/router';

const { GET, POST } = riverEndpointHandler(myRiverRouter);

export const Route = createFileRoute('/api/river/')({
	server: {
		handlers: {
			GET,
			POST
		}
	}
});
