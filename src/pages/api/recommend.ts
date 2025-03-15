// pages/api/recommendations.js
import { supabase } from '@/backend/supabase';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { queryVector } = req.body;
  if (!queryVector || !Array.isArray(queryVector)) {
    return res.status(400).json({ error: 'Invalid query vector' });
  }

  // Build the SQL query
  const query = `
    SELECT track_id, track_name, artists, features,
           features <-> '${JSON.stringify(queryVector)}'::vector AS distance
    FROM songs
    ORDER BY distance ASC
    LIMIT 10;
  `;

  // Execute the raw SQL query using Supabase
  const { data, error } = await supabase.rpc('run_sql', { sql: query });
  
  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  
  res.status(200).json(data);
}