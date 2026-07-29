export function normalizeSkuRuleToken(value) {
  return String(value || "").trim().toLowerCase();
}

export function extractSecondSkuToken(sku) {
  const parts = String(sku || "").trim().split(".");
  if (parts.length < 2) return "";
  return normalizeSkuRuleToken(parts[1]);
}

export function findSkuCategoryRule(rules, sku) {
  const token = extractSecondSkuToken(sku);
  if (!token) return null;
  return (Array.isArray(rules) ? rules : []).find(
    (rule) => normalizeSkuRuleToken(rule?.token) === token
  ) || null;
}

export function filterSkuCategoryRules(rules, query) {
  const normalizedQuery = normalizeSkuRuleToken(query);
  if (!normalizedQuery) return Array.isArray(rules) ? rules : [];
  return (Array.isArray(rules) ? rules : []).filter((rule) => {
    const token = normalizeSkuRuleToken(rule?.token);
    const categoryName = normalizeSkuRuleToken(rule?.category_name);
    return token.includes(normalizedQuery) || categoryName.includes(normalizedQuery);
  });
}

export function groupSkuCategoryRules(rules) {
  const groupsByKey = new Map();

  for (const rule of Array.isArray(rules) ? rules : []) {
    const hasCategoryId = rule?.category_id !== null && rule?.category_id !== undefined;
    const key = hasCategoryId ? `category:${rule.category_id}` : `rule:${rule?.id}`;
    const existing = groupsByKey.get(key);
    const ruleCopy = { ...rule, token: normalizeSkuRuleToken(rule?.token) };

    if (existing) {
      existing.rules.push(ruleCopy);
      existing.categoryAvailable = existing.categoryAvailable && rule?.category_available === true;
      continue;
    }

    groupsByKey.set(key, {
      key,
      categoryId: hasCategoryId ? Number(rule.category_id) : null,
      categoryName: rule?.category_name || "Danh mục không khả dụng",
      categoryAvailable: rule?.category_available === true,
      rules: [ruleCopy]
    });
  }

  return Array.from(groupsByKey.values())
    .map((group) => {
      const sortedRules = [...group.rules].sort((left, right) => (
        left.token.localeCompare(right.token, "vi", { sensitivity: "base" })
      ));
      return {
        ...group,
        rules: sortedRules,
        tokens: sortedRules.map((rule) => rule.token)
      };
    })
    .sort((left, right) => {
      const byName = left.categoryName.localeCompare(right.categoryName, "vi", { sensitivity: "base" });
      return byName || left.key.localeCompare(right.key);
    });
}

export function filterSkuCategoryRuleGroups(groups, query) {
  const normalizedQuery = normalizeSkuRuleToken(query);
  if (!normalizedQuery) return Array.isArray(groups) ? groups : [];
  return (Array.isArray(groups) ? groups : []).filter((group) => (
    normalizeSkuRuleToken(group?.categoryName).includes(normalizedQuery)
    || (Array.isArray(group?.tokens) ? group.tokens : []).some(
      (token) => normalizeSkuRuleToken(token).includes(normalizedQuery)
    )
  ));
}

export function canApplySkuCategorySuggestion({
  token,
  selectionSource,
  guardedToken = ""
}) {
  if (!token) return false;
  if (selectionSource !== "manual" && selectionSource !== "empty") return true;
  return token !== guardedToken;
}

export function resolveSkuCategorySuggestion({
  sku,
  rules,
  categories,
  selectionSource,
  guardedToken = "",
  currentCategoryId = "",
  isEditMode = false,
  hasUserEditedSku = false
}) {
  if (isEditMode && !hasUserEditedSku) return null;

  const token = extractSecondSkuToken(sku);
  if (!canApplySkuCategorySuggestion({ token, selectionSource, guardedToken })) return null;

  const rule = findSkuCategoryRule(rules, sku);
  if (!rule?.category_available || !rule.category_id) return null;

  const category = (Array.isArray(categories) ? categories : []).find(
    (item) => Number(item?.id) === Number(rule.category_id)
  );
  if (!category) return null;

  const categoryId = String(category.id);
  if (selectionSource === "suggested" && String(currentCategoryId) === categoryId) return null;
  return { token, categoryId };
}

export function getPreferredCategoryRuleToken(rules, category) {
  if (!category?.id) return "";
  const matchingRules = (Array.isArray(rules) ? rules : []).filter(
    (rule) => rule?.category_available !== false && Number(rule?.category_id) === Number(category.id)
  );
  if (!matchingRules.length) return "";

  const normalizedCode = normalizeSkuRuleToken(category.code);
  const exactCodeRule = matchingRules.find(
    (rule) => normalizeSkuRuleToken(rule.token) === normalizedCode
  );
  return normalizeSkuRuleToken(exactCodeRule?.token || matchingRules[0]?.token);
}
