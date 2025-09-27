import { randomUUID } from "crypto";
import { createInspectionSchema } from "@shared/schema";

type ChecklistItemInput = Record<string, any>;

function buildItemId(field: ChecklistItemInput, index: number): string {
  const existingId = field.id ?? field.itemId ?? field.field_id ?? field.key;
  if (existingId) {
    return existingId.toString();
  }
  return `item-${Date.now()}-${index}-${randomUUID()}`;
}

export function normalizeInspectionChecklist(
  checklist: ChecklistItemInput[] | undefined,
  templateItems: ChecklistItemInput[] | undefined
) {
  const source = Array.isArray(checklist) && checklist.length > 0 ? checklist : templateItems ?? [];

  return source.map((item, index) => {
    const id = buildItemId(item, index);
    const label = item.item ?? item.label ?? item.text ?? `Item ${index + 1}`;

    return {
      id,
      item: item.item ?? label,
      standard: item.standard ?? item.norma ?? item.reference ?? undefined,
      isCompliant:
        typeof item.isCompliant === "boolean"
          ? item.isCompliant
          : typeof item.required === "boolean" && item.required === false
          ? undefined
          : item.is_compliant,
      notes: item.notes ?? item.observations ?? item.comment ?? ""
    };
  });
}

function normalizeFindings(findings: ChecklistItemInput[] | undefined) {
  if (!Array.isArray(findings)) {
    return undefined;
  }

  return findings.map(finding => ({
    item: finding.item?.toString() ?? finding.field ?? "",
    description: finding.description?.toString() ?? finding.notes?.toString() ?? "",
    severity:
      finding.severity === "low" ||
      finding.severity === "medium" ||
      finding.severity === "high" ||
      finding.severity === "critical"
        ? finding.severity
        : "medium",
    standard: finding.standard ?? finding.reference ?? undefined,
    evidence: Array.isArray(finding.evidence)
      ? finding.evidence.map(item => item?.toString()).filter(Boolean)
      : undefined
  }));
}

export function prepareInspectionPayload(
  body: Record<string, any>,
  user: { id: string; organizationId?: string; email?: string; name?: string },
  template?: { id?: string; items?: ChecklistItemInput[] }
) {
  const title = body.title?.toString().trim();
  const location = body.location?.toString().trim();

  if (!title) {
    throw new Error("O campo 'title' é obrigatório");
  }

  if (!location) {
    throw new Error("O campo 'location' é obrigatório");
  }

  const organizationId = body.organizationId ?? user.organizationId ?? "master-org-id";
  const inspectorId = body.inspectorId ?? user.id ?? "admin-id";

  const checklistTemplateId =
    body.checklistTemplateId && body.checklistTemplateId !== "none"
      ? body.checklistTemplateId
      : template?.id ?? null;

  const normalizedChecklist = normalizeInspectionChecklist(body.checklist, template?.items);
  const normalizedFindings = normalizeFindings(body.findings);

  const status =
    body.status && ["draft", "in_progress", "completed", "approved", "rejected"].includes(body.status)
      ? body.status
      : "draft";

  const inspectionData = {
    title,
    description: body.description ?? null,
    location,
    checklistTemplateId,
    scheduledAt: body.scheduledAt ?? new Date(),
    status,
    organizationId,
    inspectorId,
    checklist: normalizedChecklist.length > 0 ? normalizedChecklist : undefined,
    findings: normalizedFindings,
    priority: body.priority ?? "medium",
    companyName: body.companyName ?? null,
    zipCode: body.zipCode ?? null,
    fullAddress: body.fullAddress ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    technicianName: body.technicianName ?? user.name ?? null,
    technicianEmail: body.technicianEmail ?? user.email ?? null,
    companyResponsibleName: body.companyResponsibleName ?? null,
    aiAssistantId: body.aiAssistantId ?? "GENERAL",
    actionPlanType: body.actionPlanType ?? "5W2H"
  };

  return createInspectionSchema.parse(inspectionData);
}

