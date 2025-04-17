// pages/api/recommend.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateSQLQuery } from '@/utils/textToSQL';
import { RecommendQueryParams } from '../../types/recommend';

interface FrontendSong {
  id: string;
  track_name: string;
  artists?: string;
  album_name?: string;
}

interface FrontendResponse {
  results: {
    song: FrontendSong;
    similarity: number;
  }[];
  query: string;
  filters: RecommendQueryParams;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FrontendResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;
    console.log("User search query:", query);
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    // Generate SQL query using Gemini
    const sqlQuery = await generateSQLQuery(query);
    console.log("Generated SQL Query:", sqlQuery);
    
    // Extract just the SELECT part of the query (remove the SET statement)
    // This assumes the query follows the template with SET followed by SELECT
    const selectQuery = sqlQuery.includes('SELECT') 
      ? sqlQuery.substring(sqlQuery.indexOf('SELECT'))
      : "SELECT id, track_name, artists, track_genre FROM songs LIMIT 10";
    
    console.log("Executing query:", selectQuery);
    
    // Execute the SQL query via RPC function
    // Note: You must create this function in your Supabase instance with the proper settings
    let responseData;
    const { data, error } = await supabase.rpc('execute_vector_search', {
      query_text: selectQuery
    });

    console.log("Supabase response:", data);
    
    if (error) {
      console.error("Error executing SQL query:", error);
      
      // Fallback to basic query if SQL execution fails
      console.log("Falling back to basic query");
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('songs')
        .select('id, track_name, artists, track_genre')
        .limit(10);
        
      if (fallbackError) {
        throw fallbackError;
      }
      
      responseData = fallbackData;
    } else {
      responseData = data;
    }
    
    if (!responseData || responseData.length === 0) {
      console.log("No results found");
      return res.status(200).json({
        results: [],
        query,
        filters: {}
      });
    }
    
    console.log(`Found ${responseData.length} results`);
    
    // Transform results into the frontend interface
    const transformedResults = responseData.map((song: any) => ({
      song: {
        id: String(song.id),
        track_name: song.track_name,
        artists: Array.isArray(song.artists) ? song.artists.join(', ') : song.artists,
        album_name: song.album_name || ''
      },
      // Use similarity score if available, otherwise default to 1.0
      similarity: typeof song.similarity === 'number' ? song.similarity : 1.0
    }));

    return res.status(200).json({
      results: transformedResults,
      query,
      filters: {}
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}