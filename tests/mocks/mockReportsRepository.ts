import {
  ReportsRepository,
  HazardReport,
  CreateHazardReportInput,
  AreaReportsFilter,
} from "@/adapters/reports";

/**
 * In-memory offline mock repository for hazard reports.
 */
export class MockReportsRepository implements ReportsRepository {
  private reports: HazardReport[] = [
    {
      id: "report-1",
      type: "pothole",
      severity: "high",
      description: "Deep pothole near Nal Stop flyover descent",
      location: { latitude: 18.5085, longitude: 73.8327 },
      neighborhood: "Kothrud",
      status: "active",
      upvotesCount: 8,
      reportedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      anonymousUserId: "anon-user-1",
    },
    {
      id: "report-2",
      type: "waterlogging",
      severity: "critical",
      description: "Severe waterlogging under Shivajinagar subway",
      location: { latitude: 18.5314, longitude: 73.8446 },
      neighborhood: "Shivajinagar",
      status: "verified",
      upvotesCount: 24,
      reportedAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date().toISOString(),
      anonymousUserId: "anon-user-2",
    },
  ];

  async createReport(input: CreateHazardReportInput): Promise<HazardReport> {
    const report: HazardReport = {
      id: `report-${Date.now()}`,
      type: input.type,
      severity: input.severity,
      description: input.description,
      location: input.location,
      neighborhood: input.neighborhood,
      landmark: input.landmark,
      photoUrl: input.photoUrl,
      status: "active",
      upvotesCount: 1,
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anonymousUserId: input.anonymousUserId,
    };
    this.reports.push(report);
    return report;
  }

  async getReportById(id: string): Promise<HazardReport | null> {
    const report = this.reports.find((r) => r.id === id);
    return report ?? null;
  }

  async getReportsInArea(filter: AreaReportsFilter): Promise<HazardReport[]> {
    let result = [...this.reports];
    if (filter.status) {
      result = result.filter((r) => r.status === filter.status);
    }
    if (filter.type) {
      result = result.filter((r) => r.type === filter.type);
    }
    return result.slice(0, filter.maxResults ?? 20);
  }

  async upvoteReport(reportId: string, _userId?: string): Promise<HazardReport> {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) {
      throw new Error(`Report with id ${reportId} not found`);
    }
    report.upvotesCount += 1;
    report.updatedAt = new Date().toISOString();
    return report;
  }

  async resolveReport(reportId: string, _resolvedBy?: string): Promise<HazardReport> {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) {
      throw new Error(`Report with id ${reportId} not found`);
    }
    report.status = "resolved";
    report.resolvedAt = new Date().toISOString();
    report.updatedAt = new Date().toISOString();
    return report;
  }
}
