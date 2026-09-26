import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL('../pages/ProductFormPage.jsx', import.meta.url), 'utf8');
const maxDeclaration = form.match(/const MAX_PRODUCT_IMAGES = (\d+);/)[0];

// Execute the actual synchronous selection guard, before React state/processing.
// This checks existing + pending + incoming without installing a JSX/DOM runner.
const selectionGuard = form.split('async function processSelectedImages(files) {')[1].split('    setImageErrors([]);')[0];
const acceptsSelection = new Function('productImages', 'pendingImages', 'files', 'setImageErrors',
  `${maxDeclaration}\n${selectionGuard}\nreturn true;`);

test('Product Form selection guard accepts six total and rejects overflow, including pending images', () => {
  for (const [existing, pending, incoming, expected] of [
    [0, 0, 6, true], [0, 0, 7, false], [5, 0, 1, true],
    [5, 0, 2, false], [6, 0, 1, false], [4, 1, 1, true], [4, 1, 2, false]
  ]) {
    let errors = [];
    const allowed = acceptsSelection(Array(existing), Array(pending), Array(incoming), (value) => { errors = value; });
    assert.equal(allowed === true, expected, `${existing} existing + ${pending} pending + ${incoming} new`);
    if (!expected) assert.match(errors[0], /tối đa 6 ảnh/);
  }
});

test('Product Form copy, disabled control and empty slots use the same six-image limit', () => {
  assert.match(maxDeclaration, /= 6;/);
  assert.match(form, /Tối đa \{MAX_PRODUCT_IMAGES\} ảnh JPEG, PNG hoặc WebP/);
  assert.match(form, /disabled=\{isUploadingImages \|\| productImages.length \+ pendingImages.length >= MAX_PRODUCT_IMAGES\}/);
  assert.match(form, /length: Math.max\(0, MAX_PRODUCT_IMAGES - productImages.length - pendingImages.length\)/);
  assert.doesNotMatch(form, /[Tt]ối đa 5 ảnh/);
});

test('OnlineListing keeps its separate five-image selection cap and copy', () => {
  const listing = readFileSync(new URL('../pages/OnlineListingPage.jsx', import.meta.url), 'utf8');
  assert.match(listing, /nextImages.slice\(0, 5\)/);
  assert.match(listing, /\[\.\.\.current, id\].slice\(0, 5\)/);
  assert.match(listing, /\[id, \.\.\.current\].slice\(0, 5\)/);
  assert.match(listing, /Chọn tối đa 5 ảnh/);
});

test('Public gallery maps the full image list and navigates by its actual length', () => {
  const gallery = readFileSync(new URL('../components/SearchResultCard.jsx', import.meta.url), 'utf8');
  assert.match(gallery, /setImages\(await listPublicProductImages\(/);
  assert.match(gallery, /images.map\(\(image, index\) =>/);
  assert.match(gallery, /\(selectedImageIndex \+ 1\) % images.length/);
  assert.doesNotMatch(gallery, /images.slice\(/);
});
