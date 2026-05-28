import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppReply } from '../handler/messageHandler';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    cron.schedule('* * * * *', async () => {
        try {
            const currentTime = Date.now();
            console.log(`[Cron Triggered at ${new Date().toISOString()}] Checking for pending reminders...`);
            
            const { data: records, error } = await supabase
                .from('records')
                .select('*')
                .ilike('collection_name', '%eminder%');
                
            console.log(`[Cron] Fetched ${records?.length || 0} reminder records.`);

            if (error || !records) {
                console.error("Cron Error fetching reminders:", error);
                return;
            }

            for (const record of records) {
                if (record.data && record.data.__status === 'pending' && record.data.__timestamp) {
                    const targetTime = parseInt(record.data.__timestamp, 10);
                    
                    // DEEP DEBUG LOG
                    console.log(`[Cron Time Check] Record ID: ${record.id}`);
                    console.log(`- Current Time: ${currentTime} (${new Date(currentTime).toISOString()})`);
                    console.log(`- Target Time:  ${targetTime} (${new Date(targetTime).toISOString()})`);
                    
                    if (currentTime >= targetTime) {
                        const phone = record.data.__phone_number;
                        const task = record.data.task || 'Apka reminder time aa gaya hai!';
                        
                        if (phone) {
                            const message = `🌌 *[Aero Temporal Alert]*\n⏰ Matrix Time Reached!\n\n⚙️ *Task:* ${task}`;
                            await sendWhatsAppReply(phone, message);
                            
                            // Delete the record completely instead of marking it completed
                            await supabase
                                .from('records')
                                .delete()
                                .eq('id', record.id);
                                
                            console.log(`Reminder sent to ${phone} for task: ${task}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Cron Job Exception:", err);
        }
    });
    console.log("AERO Temporal Scheduler Initialized.");
} else {
    console.log("Supabase keys missing. Cron Scheduler not started.");
}
