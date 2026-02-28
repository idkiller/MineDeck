import { loadConfig } from './config';
import { initAutomationScheduler } from './automation/scheduler';
import { purgeExpiredSessions } from './auth';
import { ensureAdminSeeded } from './db';

let initialized = false;

export function initServerState() {
  if (initialized) {
    return;
  }

  loadConfig();
  ensureAdminSeeded();
  purgeExpiredSessions();
  initAutomationScheduler();
  initialized = true;
}
