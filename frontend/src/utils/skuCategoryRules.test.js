import test from "node:test";
import assert from "node:assert/strict";
import {
  canApplySkuCategorySuggestion,
  extractSecondSkuToken,
  filterSkuCategoryRuleGroups,
  filterSkuCategoryRules,
  findSkuCategoryRule,
  getPreferredCategoryRuleToken,
  groupSkuCategoryRules,
  resolveSkuCategorySuggestion
} from "./skuCategoryRules.js";

const rules = [
  { id: 1, token: "main", category_id: 10, category_name: "Mainboard", category_available: true },
  { id: 2, token: "vga", category_id: 11, category_name: "VGA", category_available: true },
  { id: 3, token: "fcpu", category_id: null, category_name: null, category_available: false }
];

test("extracts and normalizes only the second dot-separated SKU token", () => {
  assert.equal(extractSecondSkuToken(" 2nd.MAIN.asus.b760 "), "main");
  assert.equal(extractSecondSkuToken("2nd.main-board.model"), "main-board");
  assert.equal(extractSecondSkuToken("main"), "");
  assert.equal(extractSecondSkuToken("2nd..model"), "");
});

test("matches an exact normalized token and rejects partial or unknown tokens", () => {
  assert.equal(findSkuCategoryRule(rules, "2nd.MAIN.asus")?.category_id, 10);
  assert.equal(findSkuCategoryRule(rules, "2nd.mainboard.asus"), null);
  assert.equal(findSkuCategoryRule(rules, "2nd.unknown.test"), null);
});

test("filters cards by token or category name case-insensitively", () => {
  assert.deepEqual(filterSkuCategoryRules(rules, "MAIN").map((rule) => rule.id), [1]);
  assert.deepEqual(filterSkuCategoryRules(rules, "vga").map((rule) => rule.id), [2]);
  assert.equal(filterSkuCategoryRules(rules, "missing").length, 0);
});

test("manual and cleared category guards hold until the second token changes", () => {
  assert.equal(canApplySkuCategorySuggestion({
    token: "main",
    selectionSource: "manual",
    guardedToken: "main"
  }), false);
  assert.equal(canApplySkuCategorySuggestion({
    token: "vga",
    selectionSource: "manual",
    guardedToken: "main"
  }), true);
  assert.equal(canApplySkuCategorySuggestion({
    token: "main",
    selectionSource: "suggested",
    guardedToken: "main"
  }), true);
});

test("prefers the category-code token and ignores unavailable rules", () => {
  assert.equal(getPreferredCategoryRuleToken(rules, { id: 10, code: "main" }), "main");
  assert.equal(getPreferredCategoryRuleToken(rules, { id: 99, code: "fcpu" }), "");
});

test("existing product loading never changes its saved category", () => {
  assert.equal(resolveSkuCategorySuggestion({
    sku: "2nd.main.asus.b760",
    rules,
    categories: [{ id: 10, name: "Mainboard" }],
    selectionSource: "manual",
    guardedToken: "main",
    currentCategoryId: "99",
    isEditMode: true,
    hasUserEditedSku: false
  }), null);
});

test("delayed rules cannot overwrite a manual choice for the current token", () => {
  assert.equal(resolveSkuCategorySuggestion({
    sku: "2nd.main.asus.b760",
    rules,
    categories: [{ id: 10, name: "Mainboard" }],
    selectionSource: "manual",
    guardedToken: "main",
    currentCategoryId: "99"
  }), null);
});

test("a genuinely changed second token can apply one active suggestion exactly once", () => {
  assert.deepEqual(resolveSkuCategorySuggestion({
    sku: "2nd.vga.asus.3070",
    rules,
    categories: [{ id: 11, name: "VGA" }],
    selectionSource: "manual",
    guardedToken: "main",
    currentCategoryId: "10"
  }), { token: "vga", categoryId: "11" });

  assert.equal(resolveSkuCategorySuggestion({
    sku: "2nd.vga.asus.3070",
    rules,
    categories: [{ id: 11, name: "VGA" }],
    selectionSource: "suggested",
    guardedToken: "vga",
    currentCategoryId: "11"
  }), null);
});

test("invalid SKU, unavailable rules and API failures leave category state unchanged", () => {
  const base = {
    categories: [{ id: 10, name: "Mainboard" }],
    selectionSource: "empty",
    currentCategoryId: "99"
  };
  assert.equal(resolveSkuCategorySuggestion({ ...base, sku: "main", rules }), null);
  assert.equal(resolveSkuCategorySuggestion({ ...base, sku: "2nd.fcpu.model", rules }), null);
  assert.equal(resolveSkuCategorySuggestion({ ...base, sku: "2nd.main.model", rules: [] }), null);
  assert.equal(resolveSkuCategorySuggestion({
    ...base,
    sku: "2nd.main.model",
    rules,
    categories: []
  }), null);
});

test("groups aliases by category while preserving independent rule ids", () => {
  const groups = groupSkuCategoryRules([
    { id: 2, token: "mainboard", category_id: 10, category_name: "Mainboard", category_available: true },
    { id: 1, token: "main", category_id: 10, category_name: "Mainboard", category_available: true }
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].tokens, ["main", "mainboard"]);
  assert.deepEqual(groups[0].rules.map((rule) => rule.id), [1, 2]);
});

test("sorts category cards and tokens alphabetically", () => {
  const groups = groupSkuCategoryRules([
    { id: 3, token: "laptop", category_id: 20, category_name: "Laptop", category_available: true },
    { id: 2, token: "bb", category_id: 5, category_name: "Barebone", category_available: true },
    { id: 1, token: "barebone", category_id: 5, category_name: "Barebone", category_available: true },
    { id: 4, token: "lap", category_id: 20, category_name: "Laptop", category_available: true }
  ]);
  assert.deepEqual(groups.map((group) => group.categoryName), ["Barebone", "Laptop"]);
  assert.deepEqual(groups[0].tokens, ["barebone", "bb"]);
  assert.deepEqual(groups[1].tokens, ["lap", "laptop"]);
});

test("filters grouped cards by category name or any token alias", () => {
  const groups = groupSkuCategoryRules([
    { id: 1, token: "main", category_id: 10, category_name: "Mainboard", category_available: true },
    { id: 2, token: "mainboard", category_id: 10, category_name: "Mainboard", category_available: true },
    { id: 3, token: "nguon", category_id: 11, category_name: "Nguồn", category_available: true }
  ]);
  assert.deepEqual(filterSkuCategoryRuleGroups(groups, "MAIN").map((group) => group.categoryName), ["Mainboard"]);
  assert.deepEqual(filterSkuCategoryRuleGroups(groups, "nguon").map((group) => group.categoryName), ["Nguồn"]);
});

test("keeps null-category rules separate and unavailable groups visible", () => {
  const groups = groupSkuCategoryRules([
    { id: 1, token: "lost-a", category_id: null, category_name: null, category_available: false },
    { id: 2, token: "lost-b", category_id: null, category_name: null, category_available: false },
    { id: 3, token: "old", category_id: 9, category_name: "Old category", category_available: false }
  ]);
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map((group) => group.key)).size, 3);
  assert.equal(groups.every((group) => group.categoryAvailable === false), true);
});

test("regrouping reflects token deletion and addition without duplicate category cards", () => {
  const initial = [
    { id: 1, token: "main", category_id: 10, category_name: "Mainboard", category_available: true },
    { id: 2, token: "mainboard", category_id: 10, category_name: "Mainboard", category_available: true }
  ];
  const afterOneDelete = groupSkuCategoryRules(initial.filter((rule) => rule.id !== 1));
  assert.equal(afterOneDelete.length, 1);
  assert.deepEqual(afterOneDelete[0].tokens, ["mainboard"]);

  const afterFinalDelete = groupSkuCategoryRules([]);
  assert.equal(afterFinalDelete.length, 0);

  const afterAdd = groupSkuCategoryRules([
    ...initial,
    { id: 3, token: "mb", category_id: 10, category_name: "Mainboard", category_available: true }
  ]);
  assert.equal(afterAdd.length, 1);
  assert.deepEqual(afterAdd[0].tokens, ["main", "mainboard", "mb"]);
});

test("groups the seeded multi-alias categories into the expected cards", () => {
  const groups = groupSkuCategoryRules([
    { id: 1, token: "bb", category_id: 1, category_name: "Barebone", category_available: true },
    { id: 2, token: "barebone", category_id: 1, category_name: "Barebone", category_available: true },
    { id: 3, token: "lap", category_id: 2, category_name: "Laptop", category_available: true },
    { id: 4, token: "laptop", category_id: 2, category_name: "Laptop", category_available: true },
    { id: 5, token: "main", category_id: 3, category_name: "Mainboard", category_available: true },
    { id: 6, token: "mainboard", category_id: 3, category_name: "Mainboard", category_available: true },
    { id: 7, token: "nguon", category_id: 4, category_name: "Nguồn", category_available: true },
    { id: 8, token: "psu", category_id: 4, category_name: "Nguồn", category_available: true }
  ]);
  const byName = Object.fromEntries(groups.map((group) => [group.categoryName, group.tokens]));
  assert.deepEqual(byName.Barebone, ["barebone", "bb"]);
  assert.deepEqual(byName.Laptop, ["lap", "laptop"]);
  assert.deepEqual(byName.Mainboard, ["main", "mainboard"]);
  assert.deepEqual(byName["Nguồn"], ["nguon", "psu"]);
});
