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
            
            // Fetch records from the 'Reminders' collection where status is pending
            const { data: records, error } = await supabase
                .from('records')
                .select('*')
                .ilike('collection_name', 'Reminders');

            if (error || !records) {
                console.error("Cron Error fetching reminders:", error);
                return;
            }

            for (const record of records) {
                if (record.data && record.data.__status === 'pending' && record.data.__timestamp) {
                    const targetTime = parseInt(record.data.__timestamp, 10);
                    
                    if (currentTime >= targetTime) {
                        const phone = record.data.__phone_number;
                        const task = record.data.task || 'Apka reminder time aa gaya hai!';
                        
                        if (phone) {
                            const message = `🌌 *[Aero Temporal Alert]*\n⏰ Matrix Time Reached!\n\n⚙️ *Task:* ${task}`;
                            await sendWhatsAppReply(phone, message);
                            
                            // Mark as completed
                            const updatedData = { ...record.data, __status: 'completed' };
                            await supabase
                                .from('records')
                                .update({ data: updatedData })
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
