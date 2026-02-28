import type { ServerProvider } from './types';
import { execCommand } from './exec';

export class SystemdProvider implements ServerProvider {
  type: 'systemd' = 'systemd';

  constructor(private serviceName: string) {}

  async restart(): Promise<void> {
    await execCommand('systemctl', ['restart', this.serviceName]);
  }

  async logsTail(lines: number): Promise<string> {
    return execCommand('journalctl', ['-u', this.serviceName, '-n', String(lines), '--no-pager']);
  }
}