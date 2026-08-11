import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(rootDir, "../.output");

export type PrintTarget = {
  mode: "simulate" | "network";
  host?: string;
  port?: number;
};

export async function sendBytes(buf: Buffer, target: PrintTarget): Promise<{ mode: PrintTarget["mode"]; path?: string }> {
  if (target.mode === "network" && target.host && target.port) {
    const host = target.host;
    const port = target.port;
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.write(buf, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
            return;
          }
          socket.end();
          resolve();
        });
      });
      socket.setTimeout(8_000, () => {
        socket.destroy();
        reject(new Error("Printer connection timed out"));
      });
      socket.on("error", reject);
    });
    return { mode: "network" };
  }

  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `job-${Date.now()}.bin`);
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(file);
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    stream.end(buf);
  });
  return { mode: "simulate", path: file };
}
