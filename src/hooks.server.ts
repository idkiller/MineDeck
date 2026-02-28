import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSessionFromCookies } from '$lib/server/auth';
import { loadConfig } from '$lib/server/config';
import { initServerState } from '$lib/server/state';

const PUBLIC_PATHS = new Set(['/login']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/_app')) {
    return true;
  }

  if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
    return true;
  }

  return false;
}

export const handle: Handle = async ({ event, resolve }) => {
  initServerState();
  event.locals.config = loadConfig();

  const session = getSessionFromCookies(event);
  event.locals.session = session;
  event.locals.user = session ? { id: session.userId, username: session.username } : null;

  const pathname = event.url.pathname;
  if (!session && !isPublicPath(pathname)) {
    throw redirect(303, '/login');
  }

  if (session && pathname === '/login') {
    throw redirect(303, '/');
  }

  return resolve(event);
};