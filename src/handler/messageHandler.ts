import { analyzeMessage } from '../ai/groq';
import { ensureCollectionExists, insertRecord, fetchCollectionRecords, deleteRecord } from '../db/supabase';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const userSessions: Record<string, string[]> = {};

export async function sendWhatsAppReply(to: string, text: string) {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
        console.error("Missing Meta credentials in .env");
        return;
    }

    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/${phoneId}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: text }
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (e: any) {
        console.error("Failed to send Meta message:", e.response?.data || e.message);
    }
}

export async function handleIncomingMessage(from: string, body: string, io: any) {
    if (!userSessions[from]) userSessions[from] = [];
    userSessions[from].push(`User: ${body}`);
    if (userSessions[from].length > 10) userSessions[from].shift();

    const history = userSessions[from].join('\n');
    let aiResult = await analyzeMessage(body, history);

    console.log("AI Output:", aiResult);

    try {
        if (aiResult.action === 'create_collection') {
            await ensureCollectionExists(aiResult.collection);
            await sendWhatsAppReply(from, aiResult.reply || `Done! Nayi sheet '${aiResult.collection}' ban gayi hai.`);
            if (io) io.emit('new_message', { type: 'system', text: `Created collection: ${aiResult.collection}` });

        } else if (aiResult.action === 'insert_record') {
            // Inject phone number for cron job routing
            if (!aiResult.data) aiResult.data = {};
            aiResult.data.__phone_number = from;

            await insertRecord(aiResult.collection, aiResult.data);
            await sendWhatsAppReply(from, aiResult.reply || `Done! Data '${aiResult.collection}' me save ho gaya.`);
            if (io) io.emit('new_message', { type: 'system', text: `Inserted into ${aiResult.collection}: ${JSON.stringify(aiResult.data)}` });

        } else if (aiResult.action === 'query') {
            // AI wants to query database to answer a question or verify identity
            const records = await fetchCollectionRecords(aiResult.collection, aiResult.filter);
            // Re-run AI with the records so it can formulate an answer or ask for clarification
            const finalAnswer = await analyzeMessage(body, history, records);
            await sendWhatsAppReply(from, finalAnswer.reply || "Ye lijiye aapki details.");

        } else if (aiResult.action === 'delete_record') {
            const deletedData = await deleteRecord(aiResult.collection, aiResult.condition);
            if (deletedData && deletedData.length > 0) {
                await sendWhatsAppReply(from, aiResult.reply || `Done! Record '${aiResult.collection}' se delete kar diya gaya hai.`);
            } else {
                await sendWhatsAppReply(from, `Mujhe '${aiResult.collection}' me aisi koi entry nahi mili delete karne ke liye. Kripya thoda aur detail me batayen.`);
            }

        } else if (aiResult.action === 'clarify' || aiResult.action === 'error') {
            await sendWhatsAppReply(from, aiResult.reply);
        } else {
            await sendWhatsAppReply(from, "Main samajh nahi paya. Kripya thoda clear batayen.");
        }

        // Add AI reply to history
        if (aiResult.reply) {
            userSessions[from].push(`AI: ${aiResult.reply}`);
        }
    } catch (e: any) {
        console.error("Handler error:", e);
        await sendWhatsAppReply(from, `Kuch gadbad ho gayi: ${e.message}`);
    }
}
