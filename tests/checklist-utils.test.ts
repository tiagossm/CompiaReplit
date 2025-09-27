import { strict as assert } from "node:assert";
import { normalizeChecklistItems, normalizeTemplatePayload, transformTemplateResponse } from "../server/utils/checklists";

const user = { id: "user-1", organizationId: "org-1" };

// normalizeChecklistItems should handle classic field definitions
const normalizedFields = normalizeChecklistItems({
  fields: [
    {
      field_name: "Extintores Verificados",
      field_type: "boolean",
      is_required: true,
      options: "Sim,Não",
      order_index: 1
    },
    {
      label: "Observações",
      type: "textarea",
      required: false,
      order_index: 2
    }
  ]
});

assert.equal(normalizedFields.length, 2, "should normalize all fields");
assert.equal(normalizedFields[0].label, "Extintores Verificados");
assert.equal(normalizedFields[0].type, "boolean");
assert.equal(normalizedFields[0].isRequired, true);
assert.deepEqual(normalizedFields[0].options, ["Sim", "Não"], "should split option strings");

// normalizeTemplatePayload should respect tags and folder mapping
const templatePayload = normalizeTemplatePayload(
  {
    name: "Checklist NR-10",
    category: "nr-10",
    parent_folder_id: "folder-1",
    tags: "segurança,energia",
    fields: [
      { field_name: "Item A", field_type: "text", is_required: false, order_index: 0 }
    ]
  },
  user
);

assert.equal(templatePayload.name, "Checklist NR-10");
assert.equal(templatePayload.folderId, "folder-1");
assert.equal(templatePayload.parentCategoryId, "folder-1");
assert.equal(templatePayload.organizationId, "org-1");
assert.equal(templatePayload.items.length, 1);
assert.equal(templatePayload.fieldCount, 1);
assert.deepEqual(templatePayload.tags, ["segurança", "energia"]);

// transformTemplateResponse should expose folder metadata
const folderTemplate = transformTemplateResponse({
  id: "folder-1",
  name: "Pasta",
  category: "__folder__",
  description: JSON.stringify({
    is_category_folder: true,
    folder_icon: "folder-open",
    folder_color: "red",
    parent_folder_id: null,
    user_description: "Itens críticos"
  }),
  organizationId: "org-1",
  items: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  fieldCount: 0
});

assert.equal(folderTemplate.is_category_folder, true);
assert.equal(folderTemplate.folder_icon, "folder-open");
assert.equal(folderTemplate.folder_color, "red");
assert.equal(folderTemplate.description, "Itens críticos");
assert.equal(folderTemplate.fields_count, 0);

console.log("checklist-utils tests passed");

