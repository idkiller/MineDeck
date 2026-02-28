import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { assertCsrf, clearSessionCookie, destroySession } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  await assertCsrf(event);

  const session = event.locals.session;
  if (session) {
    destroySession(session.id);
    clearSessionCookie(event);
  }

  throw redirect(303, '/login');
};