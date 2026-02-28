import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import {
  checkLoginRateLimit,
  clearFailedLogin,
  createSession,
  getUserByUsername,
  recordFailedLogin,
  setSessionCookie,
  verifyPassword
} from '$lib/server/auth';

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const username = String(formData.get('username') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!username || !password) {
      return fail(400, { error: 'Username and password are required.' });
    }

    const clientIp = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? event.getClientAddress();
    const rateKey = `${clientIp}:${username.toLowerCase()}`;
    const rate = checkLoginRateLimit(rateKey);

    if (!rate.allowed) {
      return fail(429, {
        error: `Too many failed attempts. Retry in ${rate.retryAfterSeconds ?? 0}s.`
      });
    }

    const user = getUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      recordFailedLogin(rateKey);
      return fail(401, { error: 'Invalid username or password.' });
    }

    clearFailedLogin(rateKey);
    const session = createSession(user.id);
    setSessionCookie(event, session);

    throw redirect(303, '/');
  }
};