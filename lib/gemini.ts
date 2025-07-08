

import { GoogleGenAI } from "@google/genai";

let genAIClientInstance: GoogleGenAI | null = null;

// Function to log warnings without complex string interpolations that might be misparsed
function logApiKeyWarning(type: 'not_set' | 'invalid_format') {
  if (type === 'not_set') {
    console.warn(
      "CRITICAL WARNING (lib/gemini.ts): process.env.API_KEY is not set or 'process' object is not available. " +
      "The GoogleGenAI client will not be initialized. AI features will likely be disabled. " +
      "For security, proxy AI calls via a backend in production."
    );
  } else if (type === 'invalid_format') {
     console.warn(
        "WARNING (lib/gemini.ts): process.env.API_KEY is defined but is not a valid non-empty string or is not accessible. " +
        "Ensure it is correctly set. The GoogleGenAI client will not be initialized. AI features will be disabled."
      );
  }
}

if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string' && process.env.API_KEY.trim() !== '') {
  try {
    genAIClientInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (e) {
    console.error("CRITICAL ERROR (lib/gemini.ts): Error initializing GoogleGenAI with API key:", e);
    genAIClientInstance = null; // Ensure it's null on error
  }
} else {
  if (typeof process === 'undefined' || !process.env) {
    logApiKeyWarning('not_set');
  } else {
    logApiKeyWarning('invalid_format');
  }
  genAIClientInstance = null;
}

export const ai = genAIClientInstance;