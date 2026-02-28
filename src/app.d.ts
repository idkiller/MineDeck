/// <reference types="@sveltejs/kit" />

import type { UserSession } from '$lib/server/auth';
import type { AppConfig } from '$lib/server/config';

declare global {
  namespace App {
    interface Locals {
      session: UserSession | null;
      user: { id: number; username: string } | null;
      config: AppConfig;
    }

    interface PageData {
      user?: { id: number; username: string } | null;
      csrfToken?: string;
    }
  }
}

export {};