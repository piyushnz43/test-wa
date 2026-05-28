import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const SYSTEM_PROMPT = `
You are a highly advanced AI managing a dynamic CRM system.
The system is built on a flexible JSONB architecture. You can dynamically create new collections (sheets/tabs) and insert arbitrary structured data into them based on the user's natural language requests.

AVAILABLE ACTIONS:
You must ALWAYS respond with ONLY a valid JSON object. No markdown, no conversational text outside the JSON.

1. "create_collection": When the user asks to create a new sheet/category/collection.
   Output: {"action": "create_collection", "collection": "Collection Name", "reply": "Your response to the user"}

2. "insert_record": When the user provides data to be saved. Determine which collection it belongs to. If the collection doesn't exist, the system will create it automatically. Extract ALL relevant entities from the user's message into a nested "data" JSON object.
   Output: {"action": "insert_record", "collection": "Collection Name", "data": {"key1": "value1", "key2": 123}, "reply": "Your response to the user"}

3. "query": When the user asks a question about their saved data (e.g. "How many motors do I have?").
   Output: {"action": "query", "collection": "Collection Name", "question": "The exact question to answer"}

4. "clarify": If the user's request is ambiguous or you don't know what data to save.
   Output: {"action": "clarify", "reply": "Your question to the user"}

CRITICAL RULES:
- Always use the "reply" field to provide a friendly, helpful Hindi/Hinglish response to the user.
- For inserts, the "data" object can have ANY keys. Choose descriptive keys (e.g., "item_name", "quantity", "amount", "status").
`;

export async function analyzeMessage(message: string, history: string = "", queryData: any = null): Promise<any> {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("Groq API Key is missing in .env");
            return { action: "error", reply: "System is not configured properly. Please add Groq API key in .env" };
        }
        
        const groq = new Groq({ apiKey });
        
        let prompt = `History:\n${history}\n\nNew Message: ${message}`;
        if (queryData) {
            prompt += `\n\nDATABASE RESULTS FOR USER'S QUERY:\n${JSON.stringify(queryData, null, 2)}\n\nBased on these database results, provide a final JSON response using the "clarify" action to answer the user's question. Example: {"action": "clarify", "reply": "Aapke paas 5 motor hain."}`;
        }
        
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const text = response.choices[0]?.message?.content || "{}";
        return JSON.parse(text);
    } catch (error) {
        console.error("Groq AI Error:", error);
        return { action: "error", reply: "AI process me error aayi. Kripya bad me try karein." };
    }
}
