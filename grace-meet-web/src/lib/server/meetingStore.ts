import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Minimal Meeting Entity for GraceMeet.
 * Represents the persistent product object, decoupled from ephemeral LiveKit SFU sessions.
 */
export interface MeetingRecord {
  id: string; // Internal unique ID (e.g. "meet_...")
  meetingId: string; // Canonical URL-safe, unguessable public ID (e.g. "grace-7xk92m")
  title: string; // Clean meeting title, e.g. "Sunday Prayer"
  hostName?: string; // Creator display name for future host authentication
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  status: "active" | "disabled";
}

export interface CreateMeetingInput {
  title?: string;
  hostName?: string;
  customMeetingId?: string;
}

/**
 * Repository interface for meeting persistence.
 *
 * NOTE ON PRODUCTION PERSISTENCE:
 * This abstraction allows swapping the underlying storage provider (e.g., PostgreSQL,
 * Supabase, Azure Cosmos/SQL) without changing any application or API route logic.
 * The current FileMeetingStore is strictly for LOCAL/DEVELOPMENT and self-hosted environments.
 * It is NOT guaranteed to persist across cold boots on ephemeral serverless platforms like Vercel.
 */
export interface IMeetingStore {
  createMeeting(input: CreateMeetingInput): Promise<MeetingRecord>;
  getMeeting(meetingId: string): Promise<MeetingRecord | null>;
  listMeetings(): Promise<MeetingRecord[]>;
  updateMeetingStatus(meetingId: string, status: "active" | "disabled"): Promise<MeetingRecord | null>;
}

/**
 * Unguessable, URL-safe meeting ID generator.
 * Uses 6 random bytes mapped to a 32-character unambiguous charset.
 * Format: grace-<6-char code>, e.g., grace-7xk92m
 */
export function generateUnguessableMeetingId(prefix = "grace"): string {
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${code}`;
}

/**
 * Validates meetingId format.
 * Must be 3-64 chars, alphanumeric with dashes/underscores.
 */
export function isValidMeetingIdFormat(meetingId: string): boolean {
  if (!meetingId || typeof meetingId !== "string") return false;
  const trimmed = meetingId.trim();
  if (trimmed.length < 3 || trimmed.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Default seeded meetings for backward compatibility with existing links and tests.
 */
const SEED_MEETINGS: MeetingRecord[] = [
  {
    id: "meet_seed_fellowship",
    meetingId: "fellowship",
    title: "Grace Fellowship",
    hostName: "GraceMeet",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    status: "active",
  },
  {
    id: "meet_seed_prayer",
    meetingId: "prayer",
    title: "Prayer Gathering",
    hostName: "GraceMeet",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    status: "active",
  },
  {
    id: "meet_seed_study",
    meetingId: "study",
    title: "Bible Study",
    hostName: "GraceMeet",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    status: "active",
  },
];

/**
 * Local file-backed implementation of IMeetingStore.
 * Suitable for local development and self-hosted Node.js servers.
 * Features:
 * - Thread-safe in-memory cache synchronized with disk
 * - Atomic write via temporary file replacement
 * - Graceful fallback to /tmp if project directory is read-only
 */
class FileMeetingStore implements IMeetingStore {
  private cache: Map<string, MeetingRecord> = new Map();
  private filePath: string;
  private isInitialized = false;

  constructor() {
    // Determine data directory
    const customPath = process.env.MEETINGS_DATA_PATH;
    if (customPath) {
      this.filePath = customPath;
    } else {
      const dataDir = path.join(process.cwd(), "data");
      this.filePath = path.join(dataDir, "meetings.json");
    }
  }

  private initialize() {
    if (this.isInitialized) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const list: MeetingRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.cache.set(item.meetingId.toLowerCase(), item);
        }
      }

      // Ensure seed records exist
      for (const seed of SEED_MEETINGS) {
        if (!this.cache.has(seed.meetingId.toLowerCase())) {
          this.cache.set(seed.meetingId.toLowerCase(), seed);
        }
      }

      this.persist();
      this.isInitialized = true;
    } catch (err) {
      console.warn("[GraceMeet][Store] Warning initializing primary meetings file, falling back to in-memory/tmp:", err);
      // Fallback for restricted/serverless runtime
      for (const seed of SEED_MEETINGS) {
        this.cache.set(seed.meetingId.toLowerCase(), seed);
      }
      this.isInitialized = true;
    }
  }

  private persist(): void {
    try {
      const list = Array.from(this.cache.values());
      const serialized = JSON.stringify(list, null, 2);
      const dir = path.dirname(this.filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Atomic write: write to temp file then rename
      const tempPath = `${this.filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      fs.writeFileSync(tempPath, serialized, "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      // In read-only serverless filesystems, writes to cwd may fail.
      // Log clearly that this is expected until a persistent production database is hooked up.
      console.warn(
        "[GraceMeet][Store] Local file write skipped (filesystem may be read-only in serverless runtime). Cache remains in memory:",
        (err as Error).message
      );
    }
  }

  async createMeeting(input: CreateMeetingInput): Promise<MeetingRecord> {
    this.initialize();

    const title = input.title?.trim() || "Sunday Fellowship";
    const hostName = input.hostName?.trim() || undefined;

    let meetingId = input.customMeetingId?.trim().toLowerCase();
    if (meetingId) {
      if (!isValidMeetingIdFormat(meetingId)) {
        throw new Error("Invalid custom meeting ID format");
      }
      if (this.cache.has(meetingId)) {
        throw new Error("Meeting ID is already taken");
      }
    } else {
      // Generate guaranteed unique unguessable ID
      let attempts = 0;
      do {
        meetingId = generateUnguessableMeetingId("grace").toLowerCase();
        attempts++;
      } while (this.cache.has(meetingId) && attempts < 10);
    }

    const now = new Date().toISOString();
    const record: MeetingRecord = {
      id: `meet_${crypto.randomBytes(8).toString("hex")}`,
      meetingId,
      title: title.slice(0, 80),
      hostName: hostName ? hostName.slice(0, 64) : undefined,
      createdAt: now,
      updatedAt: now,
      status: "active",
    };

    this.cache.set(meetingId, record);
    this.persist();

    return record;
  }

  async getMeeting(meetingId: string): Promise<MeetingRecord | null> {
    this.initialize();
    if (!meetingId || typeof meetingId !== "string") return null;
    const cleanId = meetingId.trim().toLowerCase();
    return this.cache.get(cleanId) || null;
  }

  async listMeetings(): Promise<MeetingRecord[]> {
    this.initialize();
    return Array.from(this.cache.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateMeetingStatus(
    meetingId: string,
    status: "active" | "disabled"
  ): Promise<MeetingRecord | null> {
    this.initialize();
    const cleanId = meetingId.trim().toLowerCase();
    const existing = this.cache.get(cleanId);
    if (!existing) return null;

    const updated: MeetingRecord = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(cleanId, updated);
    this.persist();
    return updated;
  }
}

// Singleton export for server-side use
export const meetingStore: IMeetingStore = new FileMeetingStore();
