/**
 * @file src/adapters/reports/repositoryFactory.ts
 * Factory selecting Firestore if FIREBASE_* keys are configured, otherwise falling back
 * to InMemoryReportsRepository with a single warning.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { InMemoryReportsRepository } from "./inMemoryReports";
import { FirestoreReportsRepository } from "./firestoreReports";

let loggedWarning = false;
let inMemorySingleton: InMemoryReportsRepository | null = null;
let firestoreSingleton: FirestoreReportsRepository | null = null;

export function getReportsRepository(): InMemoryReportsRepository | FirestoreReportsRepository {
  // Check if all 3 Firebase credentials are provided and non-dummy
  let hasFirebase = false;
  try {
    const server = env.server;
    hasFirebase = Boolean(
      server.FIREBASE_PROJECT_ID &&
      server.FIREBASE_CLIENT_EMAIL &&
      server.FIREBASE_PRIVATE_KEY &&
      server.FIREBASE_PRIVATE_KEY.length > 50 &&
      !server.FIREBASE_PRIVATE_KEY.includes("dummy") &&
      !server.FIREBASE_PRIVATE_KEY.includes("...")
    );
  } catch {
    hasFirebase = false;
  }

  if (hasFirebase) {
    try {
      if (!firestoreSingleton) {
        firestoreSingleton = new FirestoreReportsRepository();
      }
      return firestoreSingleton;
    } catch (err) {
      logger.warn(
        "Failed to initialize FirestoreReportsRepository; falling back to InMemoryReportsRepository",
        { error: err instanceof Error ? err.message : String(err) }
      );
      // Fall through to InMemory
    }
  }

  if (!loggedWarning) {
    logger.warn(
      "Firebase credentials not configured; defaulting to InMemoryReportsRepository for citizen reports."
    );
    loggedWarning = true;
  }

  if (!inMemorySingleton) {
    inMemorySingleton = new InMemoryReportsRepository();
  }

  return inMemorySingleton;
}

export function getReportsRepositoryType(): "firestore" | "memory" {
  const repo = getReportsRepository();
  return repo instanceof FirestoreReportsRepository ? "firestore" : "memory";
}

export function resetReportsRepository(): void {
  loggedWarning = false;
  inMemorySingleton = null;
  firestoreSingleton = null;
}
