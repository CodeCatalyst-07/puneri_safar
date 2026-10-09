/**
 * @file src/adapters/reports/firestoreReports.ts
 * Google Cloud Firestore implementation of citizen hazard reports repository.
 *
 * Uses firebase-admin SDK on the server side.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { Report, ReportCategory } from "@/core/types";
import { haversineMeters } from "@/core/geo";
import { evaluateCorroboration } from "@/core/safety";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CitizenReportRecord } from "./inMemoryReports";
import {
  ReportsRepository,
  HazardReport,
  CreateHazardReportInput,
  AreaReportsFilter,
} from "./index";

export class FirestoreReportsRepository implements ReportsRepository {
  private db: Firestore;

  constructor() {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: env.server.FIREBASE_PROJECT_ID,
          clientEmail: env.server.FIREBASE_CLIENT_EMAIL,
          privateKey: env.server.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
    this.db = getFirestore();
  }

  private getDb(): Firestore {
    return this.db;
  }

  async createCitizenReport(input: {
    text: string;
    lat: number;
    lng: number;
    category: ReportCategory;
    severity: 1 | 2 | 3;
    confidence: number;
    summary?: string;
    now?: Date;
    reporterHash?: string;
  }): Promise<CitizenReportRecord> {
    const db = this.getDb();
    const now = input.now ?? new Date();
    const roundedLat = Number(input.lat.toFixed(3));
    const roundedLng = Number(input.lng.toFixed(3));
    const createdAt = now.toISOString();

    // Query recent reports for corroboration
    const allRecent = await this.getAllReports();
    const id = `report-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const candidate: CitizenReportRecord = {
      id,
      text: input.text,
      category: input.category,
      severity: input.severity,
      lat: roundedLat,
      lng: roundedLng,
      createdAt,
      status: "unverified",
      confidence: input.confidence,
      summary: input.summary,
      reporterHash: input.reporterHash,
    };

    const isCorroborated = evaluateCorroboration(candidate, allRecent, now);
    if (isCorroborated) {
      candidate.status = "corroborated";
    }

    try {
      await db.collection("citizen_reports").doc(id).set(candidate);
    } catch (err) {
      logger.error(
        "Failed to write report to Firestore",
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    }

    return candidate;
  }

  async queryArea(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<{
    corroborated: Array<Omit<CitizenReportRecord, "text">>;
    unverifiedCount: number;
  }> {
    const db = this.getDb();
    const snapshot = await db.collection("citizen_reports").get();
    const center = { lat, lng };

    const corroborated: Array<Omit<CitizenReportRecord, "text">> = [];
    let unverifiedCount = 0;

    snapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as CitizenReportRecord;
      const dist = haversineMeters(center, { lat: data.lat, lng: data.lng });
      if (dist <= radiusMeters) {
        if (data.status === "corroborated" || data.status === "official") {
          corroborated.push({
            id: data.id,
            category: data.category,
            severity: data.severity,
            lat: data.lat,
            lng: data.lng,
            createdAt: data.createdAt,
            status: data.status,
            confidence: data.confidence,
            summary: data.summary,
          });
        } else {
          unverifiedCount++;
        }
      }
    });

    return { corroborated, unverifiedCount };
  }

  async getAllReports(): Promise<Report[]> {
    const db = this.getDb();
    const snapshot = await db.collection("citizen_reports").get();
    const reports: Report[] = [];

    snapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as CitizenReportRecord;
      reports.push({
        id: data.id,
        category: data.category,
        severity: data.severity,
        lat: data.lat,
        lng: data.lng,
        createdAt: data.createdAt,
        status: data.status,
        confidence: data.confidence,
        reporterHash: data.reporterHash,
      } as Report);
    });

    return reports;
  }

  // --- ReportsRepository contract ---

  async createReport(input: CreateHazardReportInput): Promise<HazardReport> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const id = `hazard-${Date.now()}`;
    const report: HazardReport = {
      id,
      type: input.type,
      severity: input.severity,
      description: input.description,
      location: input.location,
      neighborhood: input.neighborhood,
      landmark: input.landmark,
      photoUrl: input.photoUrl,
      status: "active",
      upvotesCount: 1,
      reportedAt: now,
      updatedAt: now,
      anonymousUserId: input.anonymousUserId,
    };
    await db.collection("hazard_reports").doc(id).set(report);
    return report;
  }

  async getReportById(id: string): Promise<HazardReport | null> {
    const db = this.getDb();
    const doc = await db.collection("hazard_reports").doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as HazardReport;
  }

  async getReportsInArea(filter: AreaReportsFilter): Promise<HazardReport[]> {
    const db = this.getDb();
    const snapshot = await db.collection("hazard_reports").get();
    const results: HazardReport[] = [];

    snapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as HazardReport;
      const dist = haversineMeters(
        { lat: filter.center.latitude, lng: filter.center.longitude },
        { lat: data.location.latitude, lng: data.location.longitude }
      );
      if (dist <= filter.radiusMeters) {
        results.push(data);
      }
    });

    return results;
  }

  async upvoteReport(reportId: string): Promise<HazardReport> {
    const db = this.getDb();
    const ref = db.collection("hazard_reports").doc(reportId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Report not found");
    const data = doc.data() as HazardReport;
    data.upvotesCount += 1;
    await ref.update({ upvotesCount: data.upvotesCount });
    return data;
  }

  async resolveReport(reportId: string): Promise<HazardReport> {
    const db = this.getDb();
    const ref = db.collection("hazard_reports").doc(reportId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Report not found");
    const data = doc.data() as HazardReport;
    data.status = "resolved";
    data.resolvedAt = new Date().toISOString();
    await ref.update({ status: "resolved", resolvedAt: data.resolvedAt });
    return data;
  }
}
