// Simple mock test that bypasses require.cache issue by mocking imports before route.ts is loaded.
const mockGoogleSdk = {
  createGoogleGenerativeAI: (config: { apiKey: string }) => {
    return (modelId: string) => {
      return {
        modelId,
        apiKey: config.apiKey,
        type: "mocked-google-model",
      };
    };
  }
};

let generateTextCallCount = 0;
let lastUsedApiKey = "";
let generateTextMockImpl: (options: any) => Promise<any> = async () => ({ text: "mocked response" });

const mockAiSdk = {
  generateText: async (options: any) => {
    generateTextCallCount++;
    lastUsedApiKey = options.model?.apiKey || "";
    return generateTextMockImpl(options);
  }
};

// Set up require cache intercepts BEFORE importing the route
const googleSdkPath = require.resolve("@ai-sdk/google");
require.cache[googleSdkPath] = {
  id: googleSdkPath,
  filename: googleSdkPath,
  loaded: true,
  exports: mockGoogleSdk
} as any;

const aiSdkPath = require.resolve("ai");
require.cache[aiSdkPath] = {
  id: aiSdkPath,
  filename: aiSdkPath,
  loaded: true,
  exports: mockAiSdk
} as any;

// Now require route.ts dynamically to prevent import hoisting
const { POST } = require("../app/api/transcribe/route");

const originalEnv = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, vars);
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name} passed.`);
  } catch (err) {
    console.error(`✗ ${name} failed!`);
    console.error(err);
    process.exit(1);
  }
}

async function startTests() {
  console.log("=== Running API Key Rotation and Retry Logic Tests ===");

  await runTest("Empty GEMINI_API_KEYS and fallback keys should throw error", async () => {
    setEnv({
      GEMINI_API_KEYS: "",
      GEMINI_API_KEY: "",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
    });

    const request = new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: JSON.stringify({ text: "halo\\", provider: "google" }),
    });

    const response = await POST(request);
    const data = await response.json();

    if (response.status !== 500) {
      throw new Error(`Expected 500 status, got ${response.status}`);
    }
    if (data.error !== "Gemini API Key (GEMINI_API_KEY) belum dikonfigurasi.") {
      throw new Error(`Expected specific configure error, got: ${data.error}`);
    }
  });

  await runTest("Single-key fallback configuration works perfectly", async () => {
    setEnv({
      GEMINI_API_KEYS: "",
      GEMINI_API_KEY: "fallback-secret-key-123",
    });

    generateTextCallCount = 0;
    lastUsedApiKey = "";
    generateTextMockImpl = async () => ({ text: "Hasil transkripsi." });

    const request = new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: JSON.stringify({ text: "halo\\", provider: "google" }),
    });

    const response = await POST(request);
    const data = await response.json();

    if (response.status !== 200) {
      console.error("Single-key fallback failed with body:", data);
      throw new Error(`Expected 200 status, got ${response.status}`);
    }
    if (generateTextCallCount !== 1) {
      throw new Error(`Expected 1 call to generateText, got ${generateTextCallCount}`);
    }
    if (lastUsedApiKey !== "fallback-secret-key-123") {
      throw new Error(`Expected API Key 'fallback-secret-key-123', got '${lastUsedApiKey}'`);
    }
    if (data.result !== "Hasil transkripsi.") {
      throw new Error(`Expected processed result, got '${data.result}'`);
    }
  });

  await runTest("Multi-key configuration: successfully skips invalid/failing key and retries until success", async () => {
    setEnv({
      GEMINI_API_KEYS: "key1,key2",
    });

    generateTextCallCount = 0;
    let keysCalled: string[] = [];

    generateTextMockImpl = async (options: any) => {
      const apiKey = options.model?.apiKey;
      keysCalled.push(apiKey);
      if (apiKey === "key1") {
        throw new Error("Invalid API key or Quota Exceeded");
      }
      return { text: "Success from Key 2" };
    };

    const request = new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: JSON.stringify({ text: "halo\\", provider: "google" }),
    });

    const response = await POST(request);
    const data = await response.json();

    if (response.status !== 200) {
      throw new Error(`Expected 200 status, got ${response.status}`);
    }

    if (keysCalled.includes("key1")) {
      if (keysCalled[0] === "key1") {
        if (keysCalled.length !== 2 || keysCalled[1] !== "key2") {
          throw new Error(`Expected retry flow from key1 to key2, got: ${keysCalled.join(", ")}`);
        }
      } else {
        if (keysCalled.length !== 1 || keysCalled[0] !== "key2") {
          throw new Error(`Expected key2 first success, got: ${keysCalled.join(", ")}`);
        }
      }
    }
  });

  await runTest("Multi-key configuration: completely failing results in 500 error of the last attempted key", async () => {
    setEnv({
      GEMINI_API_KEYS: "bad-key-a, bad-key-b",
    });

    generateTextCallCount = 0;

    generateTextMockImpl = async (options: any) => {
      const apiKey = options.model?.apiKey;
      if (apiKey === "bad-key-a") {
        throw new Error("Error on Key A");
      } else {
        throw new Error("Error on Key B");
      }
    };

    const request = new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: JSON.stringify({ text: "halo\\", provider: "google" }),
    });

    const response = await POST(request);
    const data = await response.json();

    if (response.status !== 500) {
      throw new Error(`Expected 500 status, got ${response.status}`);
    }

    const validErrors = ["Error on Key A", "Error on Key B"];
    if (!validErrors.includes(data.error)) {
      throw new Error(`Expected error to be one of key failures, got: ${data.error}`);
    }
  });

  await runTest("Multi-key configuration: any 429 rate limit error in history triggers rate limit formatting", async () => {
    setEnv({
      GEMINI_API_KEYS: "key-ratelimit, key-other",
    });

    generateTextCallCount = 0;
    generateTextMockImpl = async (options: any) => {
      const apiKey = options.model?.apiKey;
      if (apiKey === "key-ratelimit") {
        throw new Error("API call failed with status 429 rate limit");
      } else {
        throw new Error("Some generic connection error");
      }
    };

    const request = new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: JSON.stringify({ text: "halo\\", provider: "google" }),
    });

    const response = await POST(request);
    const data = await response.json();

    if (response.status !== 429) {
      throw new Error(`Expected 429 status, got ${response.status}`);
    }
    if (data.isRateLimit !== true) {
      throw new Error(`Expected isRateLimit to be true, got: ${data.isRateLimit}`);
    }
    if (!data.error.includes("Rate limit tercapai")) {
      throw new Error(`Expected rate limit warning error message, got: ${data.error}`);
    }
  });

  restoreEnv();
  console.log("All rotation & retry tests completed successfully!");
}

startTests();
