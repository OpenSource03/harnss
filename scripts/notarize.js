// macOS notarization hook for electron-builder.
// Release builds must provide:
// - Developer ID signing credentials: CSC_LINK + CSC_KEY_PASSWORD (or CSC_NAME from a prepared keychain)
// - Notarization credentials: either Apple ID credentials or App Store Connect API key credentials

const fs = require("fs");
const os = require("os");
const path = require("path");

function isReleaseBuild() {
  return process.env.HARNSS_REQUIRE_NOTARIZATION === "true" || process.env.GITHUB_REF?.startsWith("refs/tags/v");
}

function hasSigningCredentials() {
  return Boolean(process.env.CSC_LINK || process.env.CSC_NAME);
}

function hasEveryEnv(names) {
  return names.every((name) => Boolean(process.env[name]));
}

function hasSomeEnv(names) {
  return names.some((name) => Boolean(process.env[name]));
}

function createApiKeyFile(apiKey, apiKeyId) {
  if (fs.existsSync(apiKey)) return { apiKeyPath: apiKey, cleanup: undefined };

  const keyPath = path.join(os.tmpdir(), `AuthKey_${apiKeyId}.p8`);
  const normalizedApiKey = apiKey.includes("BEGIN PRIVATE KEY")
    ? apiKey.replace(/\\n/g, "\n")
    : Buffer.from(apiKey, "base64").toString("utf8");

  if (!normalizedApiKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("APPLE_API_KEY must be a .p8 file path, raw .p8 contents, or base64-encoded .p8 contents");
  }

  fs.writeFileSync(keyPath, normalizedApiKey, { mode: 0o600 });
  return { apiKeyPath: keyPath, cleanup: () => fs.rmSync(keyPath, { force: true }) };
}

function resolveNotarizationOptions() {
  const apiKeyEnv = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
  if (hasEveryEnv(apiKeyEnv)) {
    const { apiKeyPath, cleanup } = createApiKeyFile(process.env.APPLE_API_KEY, process.env.APPLE_API_KEY_ID);
    return {
      options: {
        appleApiKey: apiKeyPath,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER,
      },
      cleanup,
    };
  }

  const appleIdEnv = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
  if (hasEveryEnv(appleIdEnv)) {
    return {
      options: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      },
      cleanup: undefined,
    };
  }

  if (hasSomeEnv(apiKeyEnv)) {
    throw new Error(`Incomplete App Store Connect API key credentials. Required: ${apiKeyEnv.join(", ")}`);
  }
  if (process.env.APPLE_ID || process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    throw new Error(`Incomplete Apple ID notarization credentials. Required: ${appleIdEnv.join(", ")}`);
  }

  return { options: undefined, cleanup: undefined };
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const releaseBuild = isReleaseBuild();
  const { options, cleanup } = resolveNotarizationOptions();

  try {
    if (!options) {
      if (releaseBuild) {
        throw new Error("Refusing to publish an unnotarized macOS release. Configure Apple notarization credentials.");
      }
      console.log("Skipping notarization: no Apple notarization credentials set");
      return;
    }

    if (releaseBuild && !hasSigningCredentials()) {
      throw new Error("Refusing to publish an unsigned macOS release. Configure Developer ID signing credentials.");
    }

    const { notarize } = require("@electron/notarize");

    console.log(`Notarizing ${appName}...`);
    await notarize({
      appPath,
      ...options,
    });
    console.log("Notarization complete");
  } finally {
    cleanup?.();
  }
};
