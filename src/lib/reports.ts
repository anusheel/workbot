import { io } from "next/cache";
import { query } from "./db";
import type { Finding } from "./investigate";

export type Report = {
  id: string;
  requestId: string;
  report: string;
  findings: Finding[];
  dollars: number;
  createdAt: Date;
};

const columns = `id, request_id as "requestId", report, findings, dollars, created_at as "createdAt"`;

/** Files the analyst's report on a request; the latest one is what the ticket shows. */
export async function saveReport(
  requestId: string,
  report: Pick<Report, "report" | "findings" | "dollars">,
): Promise<Report> {
  const [row] = await query<Report>(
    `insert into reports (request_id, report, findings, dollars) values ($1, $2, $3, $4) returning ${columns}`,
    [requestId, report.report, report.findings, report.dollars],
  );
  return row;
}

export async function latestReport(
  requestId: string,
): Promise<Report | undefined> {
  await io();
  const [row] = await query<Report>(
    `select ${columns} from reports where request_id = $1 order by created_at desc limit 1`,
    [requestId],
  );
  return row;
}
