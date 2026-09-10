import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getEnabledPublicContactLinks, PUBLIC_CONTACT_LINKS } from "../config/publicContactLinks.js";
import {
  canStartPublicContactDrag,
  clampPublicContactPosition,
  consumePublicContactClickSuppression,
  didPublicContactPointerMove,
  getDefaultPublicContactPosition,
  getPublicContactExpansionDirection,
  getPublicContactStackSize,
  PUBLIC_CONTACT_BUTTON_SIZE,
  PUBLIC_CONTACT_DEFAULT_BOTTOM,
  PUBLIC_CONTACT_DEFAULT_RIGHT,
  PUBLIC_CONTACT_DRAG_THRESHOLD,
  PUBLIC_CONTACT_STACK_GAP
} from "./publicFloatingContacts.js";

test("contact configuration enables Facebook, Zalo, and phone in the approved order", () => {
  assert.equal(PUBLIC_CONTACT_LINKS.facebook.enabled, true);
  assert.equal(PUBLIC_CONTACT_LINKS.facebook.url, "https://www.facebook.com/mabu.m.bu.3");
  assert.equal(PUBLIC_CONTACT_LINKS.zalo.enabled, true);
  assert.equal(PUBLIC_CONTACT_LINKS.zalo.label, "Chat Zalo");
  assert.equal(PUBLIC_CONTACT_LINKS.zalo.url, "https://zalo.me/0933712571");
  assert.equal(PUBLIC_CONTACT_LINKS.phone.enabled, true);
  assert.equal(PUBLIC_CONTACT_LINKS.phone.label, "0933.712.571");
  assert.equal(PUBLIC_CONTACT_LINKS.phone.url, "tel:0933712571");

  assert.deepEqual(getEnabledPublicContactLinks().map((contact) => contact.id), ["facebook", "zalo", "phone"]);
});

test("enabled contacts still require a non-empty destination", () => {
  const contacts = getEnabledPublicContactLinks({
    facebook: { id: "facebook", enabled: true, url: "https://example.com" },
    phone: { id: "phone", enabled: false, url: "tel:1" },
    zalo: { id: "zalo", enabled: true, url: "" }
  });
  assert.deepEqual(contacts.map((contact) => contact.id), ["facebook"]);
});

test("position clamping keeps every widget edge inside desktop and mobile viewports", () => {
  const viewport = { width: 390, height: 844 };
  const widget = { width: 150, height: 100 };
  assert.deepEqual(clampPublicContactPosition({ x: -100, y: -100 }, viewport, widget), { x: 12, y: 12 });
  assert.deepEqual(clampPublicContactPosition({ x: 900, y: 1200 }, viewport, widget), { x: 228, y: 732 });
  assert.deepEqual(
    clampPublicContactPosition({ x: 900, y: 600 }, { width: 320, height: 480 }, widget),
    { x: 158, y: 368 }
  );
});

test("default placement is near the lower-right and resize uses the same clamp", () => {
  const widget = { width: 150, height: 100 };
  const defaultPosition = getDefaultPublicContactPosition({ width: 1366, height: 768 }, widget);
  assert.equal(PUBLIC_CONTACT_DEFAULT_RIGHT, 20);
  assert.equal(PUBLIC_CONTACT_DEFAULT_BOTTOM, 152);
  assert.deepEqual(defaultPosition, { x: 1196, y: 516 });

  const dragged = clampPublicContactPosition({ x: 1100, y: 500 }, { width: 1366, height: 768 }, widget);
  const resized = clampPublicContactPosition(dragged, { width: 430, height: 500 }, widget);
  assert.deepEqual(resized, { x: 268, y: 388 });
});

test("three-contact stack geometry is derived from button size and gap", () => {
  assert.equal(PUBLIC_CONTACT_BUTTON_SIZE, 50);
  assert.equal(PUBLIC_CONTACT_STACK_GAP, 8);
  assert.deepEqual(getPublicContactStackSize(3), {
    width: PUBLIC_CONTACT_BUTTON_SIZE,
    height: PUBLIC_CONTACT_BUTTON_SIZE * 3 + PUBLIC_CONTACT_STACK_GAP * 2
  });

  assert.deepEqual(
    getDefaultPublicContactPosition({ width: 390, height: 844 }, getPublicContactStackSize(3)),
    { x: 320, y: 526 }
  );
});

test("contact labels expand inward according to the widget half of the viewport", () => {
  const viewport = { width: 1366, height: 768 };
  const widget = { width: 50, height: 108 };
  assert.equal(getPublicContactExpansionDirection({ x: 20, y: 600 }, viewport, widget), "right");
  assert.equal(getPublicContactExpansionDirection({ x: 1296, y: 600 }, viewport, widget), "left");
});

test("drag threshold protects clicks and supports primary mouse, touch, and pen pointers", () => {
  assert.equal(PUBLIC_CONTACT_DRAG_THRESHOLD, 6);
  assert.equal(didPublicContactPointerMove({ x: 20, y: 20 }, { x: 23, y: 24 }), false);
  assert.equal(didPublicContactPointerMove({ x: 20, y: 20 }, { x: 26, y: 20 }), true);
  assert.equal(canStartPublicContactDrag({ pointerType: "mouse", button: 0, isPrimary: true }), true);
  assert.equal(canStartPublicContactDrag({ pointerType: "touch", button: 0, isPrimary: true }), true);
  assert.equal(canStartPublicContactDrag({ pointerType: "pen", button: 0, isPrimary: true }), true);
  assert.equal(canStartPublicContactDrag({ pointerType: "mouse", button: 2, isPrimary: true }), false);
  assert.equal(canStartPublicContactDrag({ pointerType: "touch", button: 0, isPrimary: false }), false);
});

test("Zalo click remains native below threshold and one release click is suppressed after a real drag", () => {
  const suppressionRef = { current: false };

  assert.equal(didPublicContactPointerMove({ x: 10, y: 10 }, { x: 14, y: 13 }), false);
  assert.equal(consumePublicContactClickSuppression(suppressionRef), false);

  assert.equal(didPublicContactPointerMove({ x: 10, y: 10 }, { x: 17, y: 10 }), true);
  suppressionRef.current = true;
  assert.equal(consumePublicContactClickSuppression(suppressionRef), true);
  assert.equal(suppressionRef.current, false);
  assert.equal(consumePublicContactClickSuppression(suppressionRef), false);
});

test("widget is mounted only on Public Lookup and keeps native link semantics without persistence", async () => {
  const widgetSource = await readFile(new URL("../components/public/PublicFloatingContactWidget.jsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../pages/PublicSearchPage.jsx", import.meta.url), "utf8");

  assert.equal((pageSource.match(/<PublicFloatingContactWidget\s*\/>/g) || []).length, 1);
  assert.match(widgetSource, /target=\{contact\.external \? "_blank" : undefined\}/);
  assert.match(widgetSource, /rel=\{contact\.external \? "noopener noreferrer" : undefined\}/);
  assert.match(widgetSource, /onClickCapture=\{handleClickCapture\}/);
  assert.match(widgetSource, /if \(!didPublicContactPointerMove\([\s\S]*?setPointerCapture\?\.\(event\.pointerId\)/);
  assert.doesNotMatch(
    widgetSource.match(/function handlePointerDown\(event\) \{[\s\S]*?\n  \}/)?.[0] || "",
    /setPointerCapture/
  );
  assert.match(widgetSource, /window\.addEventListener\("resize", handleResize\)/);
  assert.match(widgetSource, /isFacebook \? "Facebook" : contact\.label/);
  assert.match(widgetSource, /onMouseEnter=\{\(\) => setHoveredContactId\(contact\.id\)\}/);
  assert.match(widgetSource, /onFocus=\{\(\) => setFocusedContactId\(contact\.id\)\}/);
  assert.match(widgetSource, /Mở Zalo VI TÍNH PHƯỚC TÀI/);
  assert.match(widgetSource, /shadow-\[0_2px_6px_rgba\(15,23,42,0\.22\)\]/);
  assert.match(widgetSource, /w-max/);
  assert.match(widgetSource, /max-w-48 opacity-100/);
  assert.match(widgetSource, /max-w-0 opacity-0/);
  assert.doesNotMatch(widgetSource, /expandedWidth|w-\[126px\]|w-\[112px\]|w-\[148px\]/);
  assert.doesNotMatch(widgetSource, /gradient|brightness-110|ring-inset|ring-white\/30|shadow-\[0_4px_14px/);
  assert.doesNotMatch(widgetSource, /localStorage|sessionStorage|apiGet|apiPost|fetch\(/);
});
