import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { AppConfig } from "@main/config";
import type { SensorStatus, TapEvent } from "@shared/types";

export class SensorService extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";
  private tapCount = 0;
  private statusValue: SensorStatus = {
    code: "starting",
    source: "imu",
    keyboardFallback: false,
    message: "Starting IMU tap detector."
  };

  constructor(private readonly config: AppConfig) {
    super();
  }

  status(): SensorStatus {
    return { ...this.statusValue };
  }

  start(): void {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      this.useKeyboardFallback(
        "unsupported",
        "This Mac is not Apple Silicon macOS; using Space key fallback."
      );
      return;
    }

    const binary = this.resolveTapdPath();
    if (!binary) {
      this.useKeyboardFallback(
        "helper-missing",
        "tapd helper is not built yet; using Space key fallback."
      );
      return;
    }

    this.setStatus({
      code: "starting",
      source: "imu",
      keyboardFallback: false,
      message: "Starting tapd through sudo -n."
    });

    const child = spawn("sudo", ["-n", binary], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.process = child;

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => this.handleStdout(chunk));

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      const detail = chunk.trim();
      if (detail.includes("password") || detail.includes("sudo")) {
        this.useKeyboardFallback(
          "permission-denied",
          "sudo permission is required for IMU access; using Space key fallback.",
          detail
        );
      }
    });

    child.on("error", (error) => {
      this.useKeyboardFallback("error", "Failed to start tapd; using Space key fallback.", error.message);
    });

    child.on("close", (code) => {
      if (this.statusValue.source === "keyboard") {
        return;
      }

      if (this.statusValue.code !== "imu-ready") {
        this.useKeyboardFallback(
          code === 1 ? "permission-denied" : "error",
          "tapd exited before IMU became ready; using Space key fallback.",
          `exit code ${code ?? "unknown"}`
        );
      }
    });
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const payload = JSON.parse(line) as Record<string, unknown>;
        if (payload.type === "status") {
          const message = typeof payload.message === "string" ? payload.message : "IMU ready.";
          this.setStatus({
            code: "imu-ready",
            source: "imu",
            keyboardFallback: false,
            message,
            detail: stringField(payload, "sensorId") ?? undefined
          });
        }

        if (payload.type === "error") {
          const message = typeof payload.message === "string" ? payload.message : "tapd failed.";
          this.useKeyboardFallback(errorStatusCode(message), `${message}; using Space key fallback.`);
        }

        if (payload.type === "tap") {
          const event: TapEvent = {
            source: "imu",
            timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
            magnitude:
              typeof payload.magnitude === "number" && Number.isFinite(payload.magnitude)
                ? payload.magnitude
                : undefined,
            sensorId: stringField(payload, "sensorId") ?? undefined
          };
          this.tapCount += 1;
          this.setStatus({
            ...this.statusValue,
            code: "imu-ready",
            source: "imu",
            keyboardFallback: false,
            message: `IMU tap ${this.tapCount}.`,
            tapCount: this.tapCount,
            lastTapAt: event.timestamp,
            lastMagnitude: event.magnitude
          });
          this.emit("tap", event);
        }
      } catch {
        // Ignore non-JSON helper noise.
      }
    }
  }

  private resolveTapdPath(): string | null {
    const candidates = [
      this.config.tapdPath,
      join(process.cwd(), "tapd", "tapd"),
      join(process.cwd(), "tapd", "bin", "tapd"),
      join(process.resourcesPath ?? "", "tapd")
    ].filter((path): path is string => Boolean(path));

    return candidates.find((path) => existsSync(path)) ?? null;
  }

  private useKeyboardFallback(
    code: SensorStatus["code"],
    message: string,
    detail?: string
  ): void {
    this.stop();
    this.setStatus({
      code,
      source: "keyboard",
      keyboardFallback: true,
      message,
      detail
    });
  }

  private setStatus(status: SensorStatus): void {
    this.statusValue = {
      ...status,
      tapCount: status.tapCount ?? this.statusValue.tapCount,
      lastTapAt: status.lastTapAt ?? this.statusValue.lastTapAt,
      lastMagnitude: status.lastMagnitude ?? this.statusValue.lastMagnitude
    };
    this.emit("status", this.status());
  }
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function errorStatusCode(message: string): SensorStatus["code"] {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("root") ||
    normalized.includes("sudo") ||
    normalized.includes("permission") ||
    normalized.includes("elevated")
  ) {
    return "permission-denied";
  }

  if (normalized.includes("unsupported") || normalized.includes("not found")) {
    return "unsupported";
  }

  return "error";
}
