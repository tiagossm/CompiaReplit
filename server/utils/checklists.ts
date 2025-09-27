import { randomUUID } from "crypto";

type ChecklistItemInput = Record<string, any>;

const OPTION_DELIMITERS = ["|", ",", ";"];

function ensureStringArray(value: unknown): string[] | undefined {
  if (!value && value !== 0) return undefined;

  if (Array.isArray(value)) {
    return value
      .map(item => (item ?? "").toString().trim())
      .filter(Boolean);
  }

  const raw = value.toString();
  if (!raw.trim()) return undefined;

  const delimiter = OPTION_DELIMITERS.find(d => raw.includes(d));
  if (!delimiter) {
    return [raw.trim()];
  }

  return raw
    .split(delimiter)
    .map(option => option.trim())
    .filter(Boolean);
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function buildItemId(field: ChecklistItemInput, index: number): string {
  const existingId =
    field.id ??
    field.itemId ??
    field.field_id ??
    field.uuid ??
    field.key;

  if (existingId) {
    return existingId.toString();
  }

  return `item-${Date.now()}-${index}-${randomUUID()}`;
}

function parseOrder(field: ChecklistItemInput, index: number): number {
  if (typeof field.order === "number" && !Number.isNaN(field.order)) {
    return field.order;
  }

  if (typeof field.order_index === "number" && !Number.isNaN(field.order_index)) {
    return field.order_index;
  }

  const numericOrder = Number(field.order);
  if (!Number.isNaN(numericOrder)) {
    return numericOrder;
  }

  return index;
}

function parseWeight(field: ChecklistItemInput): number {
  if (typeof field.weight === "number") {
    return field.weight;
  }

  if (typeof field.score === "number") {
    return field.score;
  }

  const numeric = Number(field.weight);
  if (!Number.isNaN(numeric) && numeric !== 0) {
    return numeric;
  }

  return 1;
}

export function extractTemplateFields(payload: Record<string, any>): ChecklistItemInput[] {
  if (Array.isArray(payload?.items) && payload.items.length > 0) {
    return payload.items;
  }

  if (Array.isArray(payload?.fields) && payload.fields.length > 0) {
    return payload.fields;
  }

  if (Array.isArray(payload?.checklist) && payload.checklist.length > 0) {
    return payload.checklist;
  }

  return [];
}

export function normalizeChecklistItems(
  payload: Record<string, any>,
  fallbackCategory?: string
): ChecklistItemInput[] {
  const rawFields = extractTemplateFields(payload);

  const items = rawFields.map((field, index) => {
    const label =
      field.label ??
      field.field_name ??
      field.name ??
      field.item ??
      field.text ??
      `Item ${index + 1}`;

    const description =
      field.description ??
      field.field_description ??
      field.helpText ??
      field.help_text ??
      field.placeholder ??
      field.hint ??
      null;

    const type =
      field.type ??
      field.field_type ??
      field.input_type ??
      (field.options || field.field_options ? "select" : "text");

    const required = coerceBoolean(
      field.required ?? field.isRequired ?? field.is_required,
      false
    );

    const options = ensureStringArray(
      field.options ?? field.field_options ?? field.choices
    );

    const standard =
      field.standard ??
      field.norma ??
      field.reference ??
      field.regulation ??
      undefined;

    const category =
      field.category ??
      field.section ??
      fallbackCategory ??
      undefined;

    const id = buildItemId(field, index);
    const order = parseOrder(field, index);
    const weight = parseWeight(field);

    return {
      id,
      item: field.item ?? label,
      label,
      type,
      description: description ?? undefined,
      category,
      standard,
      required,
      isRequired: required,
      options,
      placeholder: field.placeholder ?? field.hint ?? undefined,
      order,
      helpText: field.helpText ?? field.help_text ?? undefined,
      referenceImage: field.referenceImage ?? field.reference_image ?? undefined,
      weight,
      min: field.min ?? undefined,
      max: field.max ?? undefined,
      metadata: field.metadata ?? undefined
    } satisfies ChecklistItemInput;
  });

  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function normalizeTemplatePayload(
  payload: Record<string, any>,
  user: { id: string; organizationId?: string }
) {
  if (!user.organizationId) {
    throw new Error("Usuário não possui organização associada");
  }

  const folderIdRaw =
    payload.folderId ??
    payload.folder_id ??
    payload.parent_folder_id ??
    payload.parentFolderId ??
    null;

  const folderId = folderIdRaw && folderIdRaw !== "none" ? folderIdRaw : null;

  const category =
    payload.category ??
    (typeof folderId === "string" && folderId ? folderId : undefined) ??
    "geral";

  const items = normalizeChecklistItems(payload, category);

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag: unknown) => tag?.toString().trim()).filter(Boolean)
    : typeof payload.tags === "string"
    ? payload.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean)
    : [];

  const isPublicValue = payload.isPublic ?? payload.is_public ?? false;

  return {
    name: (payload.name ?? "").toString().trim(),
    description:
      payload.description === undefined || payload.description === ""
        ? null
        : payload.description,
    category,
    folderId,
    organizationId: user.organizationId,
    items,
    tags,
    isPublic: coerceBoolean(isPublicValue, false),
    isActive: payload.isActive ?? true,
    isDefault: payload.isDefault ?? false,
    createdBy: user.id,
    fieldCount: items.length,
    folderColor: payload.folderColor ?? payload.folder_color ?? undefined,
    folderIcon: payload.folderIcon ?? payload.folder_icon ?? undefined,
    parentCategoryId:
      payload.parentCategoryId ??
      payload.parent_category_id ??
      (typeof folderId === "string" ? folderId : null)
  };
}

export function transformTemplateResponse(template: Record<string, any>) {
  const isCategoryFolder = Boolean(
    template.isCategoryFolder ?? template.is_category_folder ?? false
  ) || template.category === "__folder__";

  let metadata: Record<string, any> | null = null;

  if (template.description && typeof template.description === "string") {
    try {
      const parsed = JSON.parse(template.description);
      if (parsed && typeof parsed === "object" && parsed.is_category_folder) {
        metadata = parsed;
      }
    } catch (error) {
      // ignore malformed metadata – description will be returned as-is
    }
  }

  const folderIcon =
    template.folderIcon ?? metadata?.folder_icon ?? template.folder_icon ?? "folder";
  const folderColor =
    template.folderColor ?? metadata?.folder_color ?? template.folder_color ?? "blue";
  const parentFolderId =
    template.parentCategoryId ??
    template.parent_folder_id ??
    template.folderId ??
    metadata?.parent_folder_id ??
    null;

  const description = isCategoryFolder
    ? metadata?.user_description ?? template.description ?? ""
    : template.description ?? null;

  const items = Array.isArray(template.items)
    ? [...template.items].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    : [];

  return {
    ...template,
    description,
    items,
    is_category_folder: isCategoryFolder,
    folder_icon: folderIcon,
    folder_color: folderColor,
    parent_folder_id: parentFolderId,
    fields_count:
      template.fieldCount ?? template.fields_count ?? (Array.isArray(items) ? items.length : 0),
    created_at: template.createdAt ?? template.created_at ?? null,
    updated_at: template.updatedAt ?? template.updated_at ?? null,
    is_public: template.isPublic ?? template.is_public ?? false
  };
}

