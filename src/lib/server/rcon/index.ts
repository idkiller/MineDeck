import net from 'node:net';
import { loadConfig } from '../config';
import { readServerProperties } from '../files/properties';
import { resolveDataPath } from '../files/paths';

interface RconPacket {
  id: number;
  type: number;
  payload: string;
}

interface EffectiveRconConfig {
  enabled: boolean;
  host: string;
  port?: number;
  password?: string;
}

class SimpleRconClient {
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, { resolve: (pkt: RconPacket) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>();

  constructor(private host: string, private port: number, private password: string) {}

  private sendPacket(id: number, type: number, payload: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const payloadBuffer = Buffer.from(payload, 'utf8');
    const size = 4 + 4 + payloadBuffer.length + 2;
    const packet = Buffer.alloc(4 + size);

    packet.writeInt32LE(size, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    payloadBuffer.copy(packet, 12);
    packet.writeInt16LE(0, 12 + payloadBuffer.length);

    this.socket.write(packet);
  }

  private handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (this.buffer.length < size + 4) {
        break;
      }

      const packetBuffer = this.buffer.subarray(4, 4 + size);
      this.buffer = this.buffer.subarray(4 + size);

      const packet: RconPacket = {
        id: packetBuffer.readInt32LE(0),
        type: packetBuffer.readInt32LE(4),
        payload: packetBuffer.subarray(8, packetBuffer.length - 2).toString('utf8')
      };

      const pending = this.pending.get(packet.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(packet.id);
        pending.resolve(packet);
      }
    }
  }

  private waitForPacket(id: number, timeoutMs = 5000): Promise<RconPacket> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Timed out waiting for RCON response'));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  async connect() {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port }, () => {
        this.socket = socket;
        socket.on('data', (chunk) => this.handleData(chunk));
        socket.on('error', (error) => {
          for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
          }
          this.pending.clear();
        });
        resolve();
      });

      socket.once('error', reject);
      socket.setTimeout(7000, () => {
        socket.destroy(new Error('RCON socket timeout'));
      });
    });

    const authId = 1;
    this.sendPacket(authId, 3, this.password);
    const authResponse = await this.waitForPacket(authId);

    if (authResponse.id === -1) {
      throw new Error('RCON authentication failed');
    }
  }

  async run(command: string): Promise<string> {
    const cmdId = 2;
    this.sendPacket(cmdId, 2, command);
    const response = await this.waitForPacket(cmdId);
    return response.payload;
  }

  close() {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
  }
}

export async function resolveRconConfig(): Promise<EffectiveRconConfig> {
  const config = loadConfig();
  const propsPath = resolveDataPath('server.properties');
  const props = await readServerProperties(propsPath);

  const enabled = (props.map['enable-rcon'] ?? 'false').toLowerCase() === 'true';
  const port = config.rcon.port ?? Number(props.map['rcon.port']);
  const password = config.rcon.password ?? props.map['rcon.password'];

  return {
    enabled,
    host: config.rcon.host,
    port: Number.isFinite(port) ? Number(port) : undefined,
    password
  };
}

export async function runRconCommand(command: string): Promise<string> {
  const cfg = await resolveRconConfig();
  if (!cfg.enabled) {
    throw new Error('RCON is disabled in server.properties');
  }

  if (!cfg.port || !cfg.password) {
    throw new Error('RCON port/password missing');
  }

  const client = new SimpleRconClient(cfg.host, cfg.port, cfg.password);
  try {
    await client.connect();
    return await client.run(command);
  } finally {
    client.close();
  }
}

export async function checkRconStatus(): Promise<{ ok: boolean; message: string }> {
  const cfg = await resolveRconConfig();
  if (!cfg.enabled) {
    return { ok: false, message: 'RCON disabled' };
  }

  if (!cfg.port || !cfg.password) {
    return { ok: false, message: 'RCON missing port/password' };
  }

  try {
    const output = await runRconCommand('list');
    return { ok: true, message: output || 'Connected' };
  } catch (error: any) {
    return { ok: false, message: error?.message ?? 'Connection failed' };
  }
}