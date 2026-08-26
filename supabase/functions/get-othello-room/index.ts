import {
  createAdminClient,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireUser,
  stringField,
} from '../_shared/http.ts';
import { readOthelloRoom } from '../_shared/room.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const user = await requireUser(request);
    const body = await request.json();
    const roomId = stringField(body.roomId, 'roomId');
    return jsonResponse(await readOthelloRoom(createAdminClient(), roomId, user.id));
  } catch (error) {
    return errorResponse(error);
  }
});

