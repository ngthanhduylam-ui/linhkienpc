const config = require("./config");

let context = null;
let launchPromise = null;
let lastLaunchError = null;
let isClosing = false;

function isPostingUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("chotot.com") && /dang|post|listing|sell/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function markContextClosed(closedContext) {
  if (!closedContext || closedContext === context) {
    context = null;
  }
  isClosing = false;
}

function resetStaleContext() {
  context = null;
  launchPromise = null;
  isClosing = false;
}

function canUseContext(candidate) {
  if (!candidate || isClosing) return false;
  try {
    candidate.pages();
    return true;
  } catch {
    return false;
  }
}

async function launchContext() {
  const { chromium } = require("playwright");
  const nextContext = await chromium.launchPersistentContext(config.userDataDir, {
    channel: "chrome",
    headless: false,
    acceptDownloads: true
  });
  nextContext.once("close", () => markContextClosed(nextContext));
  nextContext.pages();
  context = nextContext;
  lastLaunchError = null;
  return nextContext;
}

async function ensureBrowserContext() {
  if (canUseContext(context)) return context;
  if (launchPromise) return launchPromise;

  resetStaleContext();
  launchPromise = launchContext()
    .catch((error) => {
      lastLaunchError = error;
      const wrapped = new Error("BROWSER_NOT_READY");
      wrapped.code = "BROWSER_NOT_READY";
      wrapped.detail = { message: error.message };
      throw wrapped;
    })
    .finally(() => {
      launchPromise = null;
    });
  return launchPromise;
}

async function getOrCreatePostingPage() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const activeContext = await ensureBrowserContext();
    try {
      let page = activeContext.pages().find((candidate) => !candidate.isClosed() && isPostingUrl(candidate.url()));
      if (!page) {
        page = await activeContext.newPage();
        await page.goto(config.postingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      }
      await page.bringToFront();
      return page;
    } catch (error) {
      resetStaleContext();
      if (attempt === 1) {
        const wrapped = new Error("BROWSER_NOT_READY");
        wrapped.code = "BROWSER_NOT_READY";
        wrapped.detail = { message: error.message };
        throw wrapped;
      }
    }
  }
  const error = new Error("BROWSER_NOT_READY");
  error.code = "BROWSER_NOT_READY";
  throw error;
}

async function closeBrowserContext() {
  if (!context) return;
  const closingContext = context;
  isClosing = true;
  context = null;
  try {
    await closingContext.close();
  } finally {
    isClosing = false;
  }
}

function getBrowserStatus() {
  return {
    browserReady: canUseContext(context),
    launching: Boolean(launchPromise),
    lastLaunchError: lastLaunchError?.message || ""
  };
}

module.exports = {
  closeBrowserContext,
  ensureBrowserContext,
  getBrowserStatus,
  getOrCreatePostingPage
};
