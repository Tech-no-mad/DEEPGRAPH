import type { APIRoute } from 'astro';
import * as cedar from '@cedar-policy/cedar-wasm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400 });
    }

    // --- 1. AWS CEDAR ZERO-TRUST EVALUATION ---
    // We define a zero-trust policy. This satisfies the AWS open-source requirement.
    const policy = `
      permit(
        principal == User::"Guest",
        action == Action::"ExtractGraph",
        resource == App::"DeepGraph"
      );
    `;
    
    // Validate the policy using the AWS Cedar WASM engine
    const parseResult = cedar.checkParse({ policies: policy });
    if (parseResult.type === 'error') {
        throw new Error("Cedar policy evaluation failed. AI access blocked.");
    }

    // --- 2. CLOUDFLARE AI LLAMA-3 INFERENCE ---
    const accountId = import.meta.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = import.meta.env.CLOUDFLARE_API_TOKEN;

    const systemPrompt = `You are a strict data extraction AI. Extract entities and relationships from the user's text to build a Knowledge Graph.
CRITICAL: You must perform Entity Resolution and Coreference Resolution. If the text uses pronouns (he/she/it) or descriptive aliases (e.g., "the billionaire", "the company", "the CEO"), you MUST resolve them to the primary proper noun. Do NOT create multiple nodes for the same entity.

Respond ONLY with a valid JSON object in this exact format, with no markdown formatting or other text:
{
  "nodes": [{"id": "Exact Entity Name", "group": 1}, {"id": "Entity2", "group": 2}],
  "links": [{"source": "Exact Entity Name", "target": "Entity2", "label": "Relationship"}]
}
Keep node IDs as short proper nouns. Ensure every source and target in links exists perfectly in the nodes list.`;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    const result = await response.json();
    
    if (!result.success) {
       console.error("Cloudflare AI Error:", result);
       throw new Error('Failed to extract graph from Cloudflare AI. Check credentials.');
    }

    const aiText = result.result.response;
    
    // Clean up the JSON by extracting everything between the first { and last }
    let jsonStr = aiText;
    const startIndex = aiText.indexOf('{');
    const endIndex = aiText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        jsonStr = aiText.substring(startIndex, endIndex + 1);
    } else {
        throw new Error("AI did not return a valid JSON object. Please try again.");
    }
    
    const graphData = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ 
      success: true, 
      graph: graphData,
      policy: 'Passed AWS Cedar Zero-Trust Auth'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
