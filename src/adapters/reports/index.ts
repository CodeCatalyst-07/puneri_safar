/**
 * @file src/adapters/reports/index.ts
 * Interface and repository contract for citizen hazard and safety reports.
 *
 * Backed by Cloud Firestore in production, fully swappable for offline testing.
 */

export type HazardType =
  | "pothole"
  | "waterlogging"
  | "broken_streetlight"
  | "fallen_tree"
  | "traffic_jam_chokepoint"
  | "road_construction"
  | "unlit_area";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export type ReportStatus = "active" | "verified" | "resolved";

export interface ReportCoordinates {
  latitude: number;
  longitude: number;
}

export interface HazardReport {
  id: string;
  type: HazardType;
  severity: HazardSeverity;
  description: string;
  location: ReportCoordinates;
  neighborhood: string;
  landmark?: string;
  photoUrl?: string;
  status: ReportStatus;
  upvotesCount: number;
  reportedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  anonymousUserId: string;
}

export interface CreateHazardReportInput {
  type: HazardType;
  severity: HazardSeverity;
  description: string;
  location: ReportCoordinates;
  neighborhood: string;
  landmark?: string;
  photoUrl?: string;
  anonymousUserId: string;
}

export interface AreaReportsFilter {
  center: ReportCoordinates;
  radiusMeters: number;
  status?: ReportStatus;
  type?: HazardType;
  maxResults?: number;
}

/**
 * Repository contract for community hazard reports.
 */
export interface ReportsRepository {
  /**
   * Persists a newly reported citizen hazard.
   */
  createReport(input: CreateHazardReportInput): Promise<HazardReport>;

  /**
   * Fetches a report by its unique identifier.
   */
  getReportById(id: string): Promise<HazardReport | null>;

  /**
   * Queries active hazard reports within a geographic radius in Pune.
   */
  getReportsInArea(filter: AreaReportsFilter): Promise<HazardReport[]>;

  /**
   * Increments validation score/upvotes for community confirmation.
   */
  upvoteReport(reportId: string, userId: string): Promise<HazardReport>;

  /**
   * Marks a hazard as resolved once the municipal body or citizens verify clearing.
   */
  resolveReport(reportId: string, resolvedBy: string): Promise<HazardReport>;
}

export * from "./inMemoryReports";
export * from "./firestoreReports";
export * from "./repositoryFactory";
