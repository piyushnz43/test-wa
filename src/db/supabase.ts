import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase Configuration is missing in .env');
    }
    return createClient(supabaseUrl, supabaseKey);
}

export async function ensureCollectionExists(name: string): Promise<void> {
    const supabase = getSupabaseClient();
    // Check if collection exists
    const { data } = await supabase.from('collections').select('id').ilike('name', name).single();
    if (!data) {
        // Create if not exists
        await supabase.from('collections').insert([{ name }]);
    }
}

export async function insertRecord(collectionName: string, recordData: any) {
    const supabase = getSupabaseClient();
    await ensureCollectionExists(collectionName);
    
    const { data, error } = await supabase
        .from('records')
        .insert([{ collection_name: collectionName, data: recordData }])
        .select();
    if (error) throw error;
    return data;
}

export async function fetchCollectionRecords(collectionName: string, filter?: any) {
    const supabase = getSupabaseClient();
    let query = supabase
        .from('records')
        .select('*')
        .ilike('collection_name', collectionName);
        
    if (filter) {
        query = query.contains('data', filter);
    }
        
    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);
        
    if (error) throw error;
    return data;
}

export async function fetchAllCollections() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('collections').select('name');
    if (error) throw error;
    return data.map(c => c.name);
}

export async function deleteRecord(collectionName: string, condition: any) {
    const supabase = getSupabaseClient();
    
    // Convert the condition into a PostgREST filter. 
    // Supabase has a .contains('data', condition) that checks if JSONB contains the exact key-value pairs.
    const { data, error } = await supabase
        .from('records')
        .delete()
        .ilike('collection_name', collectionName)
        .contains('data', condition)
        .select();
        
    if (error) throw error;
    return data;
}
