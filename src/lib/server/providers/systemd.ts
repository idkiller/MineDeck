import type { ServerProvider } from './types';
import { execCommand } from './exec';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

export class SystemdProvider implements ServerProvider {
  type: 'systemd' = 'systemd';

  constructor(
    private serviceName: string,
    private commandExec?: string
  ) {}

  async restart(): Promise<void> {
    await execCommand('systemctl', ['restart', this.serviceName]);
  }

  async logsTail(lines: number): Promise<string> {
    return execCommand('journalctl', ['-u', this.serviceName, '-n', String(lines), '--no-pager']);
  }

  private async getMainPid(): Promise<number> {
    const raw = await execCommand('systemctl', ['show', '-p', 'MainPID', '--value', this.serviceName]);
    const pid = Number(raw.trim());
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error(`Systemd service ${this.serviceName} is not running (MainPID=${raw.trim() || 'empty'})`);
    }
    return pid;
  }

  async commandStatus() {
    if (this.commandExec) {
      try {
        await fs.access(this.commandExec);
        return {
          ok: true,
          message: `Using helper command: ${this.commandExec}`
        };
      } catch {
        return {
          ok: false,
          message: `Configured helper not found: ${this.commandExec}`
        };
      }
    }

    try {
      const pid = await this.getMainPid();
      await fs.access(`/proc/${pid}/fd/0`, fsConstants.W_OK);
      return {
        ok: true,
        message: `Using stdin injection on MainPID ${pid}`
      };
    } catch (error: any) {
      return {
        ok: false,
        message:
          error?.message ??
          'No systemd command channel configured. Set systemd.commandExec (or MINEDECK_SYSTEMD_COMMAND_EXEC).'
      };
    }
  }

  async runCommand(command: string) {
    if (this.commandExec) {
      const output = await execCommand(this.commandExec, [command]);
      return {
        output,
        message: output ? 'Command executed via systemd helper.' : 'Command sent via systemd helper.'
      };
    }

    const pid = await this.getMainPid();
    await fs.writeFile(`/proc/${pid}/fd/0`, `${command}\n`);
    return {
      output: '',
      message: `Command sent to service stdin (MainPID ${pid}).`
    };
  }
}
