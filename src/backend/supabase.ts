
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY as string
console.log(supabaseKey, "Supabase  Key")
if(!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and Key are required")
}
export const supabase = createClient(supabaseUrl, supabaseKey)