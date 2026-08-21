import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminReturnLocation } from "./adminPublicNavigation.js";

const ORIGIN = "https://vitinhphuoctai.com";

test("accepts only same-origin Admin return locations", () => {
  assert.equal(validateAdminReturnLocation("/admin/products", ORIGIN), "/admin/products");
  assert.equal(
    validateAdminReturnLocation("/admin/products?name=abc", ORIGIN),
    "/admin/products?name=abc"
  );
  assert.equal(validateAdminReturnLocation("/admin/products#x", ORIGIN), "/admin/products#x");
});

test("rejects external, executable, non-Admin, and missing destinations", () => {
  assert.equal(validateAdminReturnLocation("//evil.example", ORIGIN), "/admin");
  assert.equal(validateAdminReturnLocation("https://evil.example", ORIGIN), "/admin");
  assert.equal(validateAdminReturnLocation("javascript:alert(1)", ORIGIN), "/admin");
  assert.equal(validateAdminReturnLocation("/public", ORIGIN), "/admin");
  assert.equal(validateAdminReturnLocation("", ORIGIN), "/admin");
  assert.equal(validateAdminReturnLocation(null, ORIGIN), "/admin");
});
