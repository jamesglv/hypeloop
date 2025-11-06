import OpenAI from "openai";

// Get API key from environment variable
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Only create OpenAI client if API key is provided
// Note: Using OpenAI in the browser is not recommended for production
// Consider using Edge Functions instead for security
export const openai = apiKey 
  ? new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // ⚠️ Only use in browser with proper security measures
    })
  : null;

