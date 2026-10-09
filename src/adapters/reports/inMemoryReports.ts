/**
 * @file src/adapters/reports/inMemoryReports.ts
 * In-memory repository for citizen hazard reports with automatic corroboration.
 */

import { Report, ReportCategory, ReportStatus } from "@/core/types";
import { haversineMeters } from "@/core/geo";
import { evaluateCorroboration } from "@/core/safety";
import {
  ReportsRepository,
  HazardReport,
  CreateHazardReportInput,
  AreaReportsFilter,
} from "./index";

export interface CitizenReportRecord {
  id: string;
  text: string;
  category: ReportCategory;
  severity: 1 | 2 | 3;
  lat: number;
  lng: number;
  createdAt: string;
  status: ReportStatus;
  confidence: number;
  summary?: string;
  reporterHash?: string;
}

export class InMemoryReportsRepository implements ReportsRepository {
  private reports: CitizenReportRecord[] = [];
  private legacyHazardReports: HazardReport[] = [];

  constructor() {
    // Seed with initial realistic Pune community reports
    const now = new Date();
    this.reports.push({
      id: "report-seed-1",
      text: "Deep pothole near Nal Stop flyover descending ramp",
      category: "road_hazard",
      severity: 2,
      lat: 18.508,
      lng: 73.832,
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      status: "corroborated",
      confidence: 0.9,
      summary: "Pothole near Nal Stop",
      reporterHash: "seed-reporter-1",
    });
    this.reports.push({
      id: "report-seed-2",
      text: "Water accumulation under Shivajinagar railway underpass after shower",
      category: "waterlogging",
      severity: 2,
      lat: 18.531,
      lng: 73.846,
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      status: "corroborated",
      confidence: 0.85,
      summary: "Water accumulation under Shivajinagar underpass",
      reporterHash: "seed-reporter-2",
    });
  }

  /**
   * Creates a citizen report with coordinates rounded to 3 decimal places.
   * Runs core corroboration check (>= 2 reports within 200m in last 48h).
   */
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
    const now = input.now ?? new Date();
    const roundedLat = Number(input.lat.toFixed(3));
    const roundedLng = Number(input.lng.toFixed(3));
    const createdAt = now.toISOString();
    const id = `report-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const candidate: CitizenReportRecord = {
      id,
      text: input.text,
      category: input.category,
      severity: input.severity,
      lat: roundedLat,
      lng: roundedLng,
      createdAt,
      status: "unverified" as ReportStatus,
      confidence: input.confidence,
      summary: input.summary,
      reporterHash: input.reporterHash,
    };

    // Check if new report is corroborated by existing reports
    const existingDomainReports: Array<Report & { reporterHash?: string }> = this.reports.map(
      (r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.createdAt,
        status: r.status,
        confidence: r.confidence,
        reporterHash: r.reporterHash,
      })
    );

    const isCorroborated = evaluateCorroboration(candidate, existingDomainReports, now);
    if (isCorroborated) {
      candidate.status = "corroborated";

      // Also retroactively mark matching unverified neighbors as corroborated
      const windowMs = 48 * 3600 * 1000;
      for (const r of this.reports) {
        if (r.category === candidate.category && r.status === "unverified") {
          const age = now.getTime() - new Date(r.createdAt).getTime();
          if (age >= 0 && age <= windowMs) {
            const dist = haversineMeters(
              { lat: candidate.lat, lng: candidate.lng },
              { lat: r.lat, lng: r.lng }
            );
            if (dist <= 200) {
              r.status = "corroborated";
            }
          }
        }
      }
    }

    this.reports.push(candidate);
    return candidate;
  }

  /**
   * Queries reports within geographic radius.
   * Returns corroborated/official reports plus counts of unverified ones without text.
   */
  async queryArea(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<{
    corroborated: Array<Omit<CitizenReportRecord, "text">>;
    unverifiedCount: number;
  }> {
    const center = { lat, lng };
    const corroborated: Array<Omit<CitizenReportRecord, "text">> = [];
    let unverifiedCount = 0;

    for (const r of this.reports) {
      const dist = haversineMeters(center, { lat: r.lat, lng: r.lng });
      if (dist <= radiusMeters) {
        if (r.status === "corroborated" || r.status === "official") {
          // Return without raw citizen text for privacy
          corroborated.push({
            id: r.id,
            category: r.category,
            severity: r.severity,
            lat: r.lat,
            lng: r.lng,
            createdAt: r.createdAt,
            status: r.status,
            confidence: r.confidence,
            summary: r.summary,
          });
        } else {
          unverifiedCount++;
        }
      }
    }

    return { corroborated, unverifiedCount };
  }

  /**
   * Returns all reports mapped to domain Report type for routing hazard assessments.
   */
  async getAllReports(): Promise<Report[]> {
    return this.reports.map((r) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      lat: r.lat,
      lng: r.lng,
      createdAt: r.createdAt,
      status: r.status,
      confidence: r.confidence,
    }));
  }

  // --- ReportsRepository contract implementation ---

  async createReport(input: CreateHazardReportInput): Promise<HazardReport> {
    const now = new Date().toISOString();
    const hazard: HazardReport = {
      id: `legacy-${Date.now()}`,
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
    this.legacyHazardReports.push(hazard);
    return hazard;
  }

  async getReportById(id: string): Promise<HazardReport | null> {
    return this.legacyHazardReports.find((r) => r.id === id) ?? null;
  }

  async getReportsInArea(filter: AreaReportsFilter): Promise<HazardReport[]> {
    return this.legacyHazardReports.filter((r) => {
      const dist = haversineMeters(
        { lat: filter.center.latitude, lng: filter.center.longitude },
        { lat: r.location.latitude, lng: r.location.longitude }
      );
      return dist <= filter.radiusMeters;
    });
  }

  async upvoteReport(reportId: string): Promise<HazardReport> {
    const report = this.legacyHazardReports.find((r) => r.id === reportId);
    if (!report) throw new Error("Report not found");
    report.upvotesCount += 1;
    return report;
  }

  async resolveReport(reportId: string): Promise<HazardReport> {
    const report = this.legacyHazardReports.find((r) => r.id === reportId);
    if (!report) throw new Error("Report not found");
    report.status = "resolved";
    return report;
  }

  clear(): void {
    this.reports = [];
    this.legacyHazardReports = [];
  }
}
