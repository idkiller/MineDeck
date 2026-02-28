import type { ServerProvider } from './types';
import { execCommand } from './exec';

export class DockerProvider implements ServerProvider {
  type: 'docker' = 'docker';

  constructor(private containerName: string) {}

  async restart(): Promise<void> {
    await execCommand('docker', ['restart', this.containerName]);
  }

  async logsTail(lines: number): Promise<string> {
    return execCommand('docker', ['logs', '--tail', String(lines), this.containerName]);
  }

  async commandStatus() {
    try {
      await execCommand('docker', ['exec', this.containerName, 'sh', '-lc', 'command -v send-command >/dev/null 2>&1']);
      return {
        ok: true,
        message: 'send-command available'
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message ?? 'send-command unavailable'
      };
    }
  }

  async runCommand(command: string) {
    const output = await execCommand('docker', ['exec', this.containerName, 'send-command', command]);
    return {
      output,
      message: output ? 'Command executed via send-command.' : 'Command sent via send-command.'
    };
  }
}
