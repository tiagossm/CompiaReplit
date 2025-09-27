import { strict as assert } from "node:assert";
import { prepareInspectionPayload, normalizeInspectionChecklist } from "../server/utils/inspections";

const user = {
  id: "inspector-1",
  organizationId: "org-1",
  email: "user@example.com",
  name: "Inspector"
};

// prepareInspectionPayload should use template items when provided
const template = {
  id: "template-1",
  items: [
    { id: "1", label: "Item A", standard: "NR-10" },
    { id: "2", label: "Item B" }
  ]
};

const inspectionPayload = prepareInspectionPayload(
  {
    title: "Inspeção elétrica",
    location: "Planta 1",
    description: "Verificação de rotina",
    checklistTemplateId: template.id,
    priority: "high"
  },
  user,
  template
);

assert.equal(inspectionPayload.title, "Inspeção elétrica");
assert.equal(inspectionPayload.status, "draft");
assert.equal(inspectionPayload.priority, "high");
assert.ok(Array.isArray(inspectionPayload.checklist));
assert.equal(inspectionPayload.checklist?.length, 2);
assert.equal(inspectionPayload.checklist?.[0].item, "Item A");
assert.equal(inspectionPayload.organizationId, "org-1");

// When checklist is provided directly it should be normalized
const customChecklist = normalizeInspectionChecklist(
  [
    { label: "Item X", notes: "ok" },
    { item: "Item Y", isCompliant: false }
  ],
  undefined
);

assert.equal(customChecklist.length, 2);
assert.equal(customChecklist[0].item, "Item X");
assert.equal(customChecklist[0].notes, "ok");

const payloadWithChecklist = prepareInspectionPayload(
  {
    title: "Inspeção manual",
    location: "Depósito",
    checklist: [
      { label: "Portas", notes: "Trancadas" }
    ],
    findings: [
      { item: "Portas", description: "Trava com desgaste", severity: "low" }
    ]
  },
  user
);

assert.equal(payloadWithChecklist.checklist?.length, 1);
assert.equal(payloadWithChecklist.findings?.[0].severity, "low");
assert.equal(payloadWithChecklist.technicianEmail, user.email);

console.log("inspection-utils tests passed");

