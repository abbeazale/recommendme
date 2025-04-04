// pages/api/recommendations.js
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Song, RecommendQueryParams, RecommendResponse } from '../../types/recommend';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY as string
);

// FastAPI endpoint for generating embeddings
const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'http://localhost:8000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecommendResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, filters = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    // Validate and sanitize filters
    const validatedFilters = validateFilters(filters);
    
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Build the Supabase query
    let supabaseQuery = supabase
      .from('songsnodupe')
      .select('*')
      .order('features <-> :embedding', { ascending: true })
      .limit(validatedFilters.limit || 10);

    // Apply filters
    if (validatedFilters.genres?.length) {
      supabaseQuery = supabaseQuery.in('track_genre', validatedFilters.genres);
    }
    if (validatedFilters.min_popularity !== undefined) {
      supabaseQuery = supabaseQuery.gte('popularity', validatedFilters.min_popularity);
    }
    if (validatedFilters.max_popularity !== undefined) {
      supabaseQuery = supabaseQuery.lte('popularity', validatedFilters.max_popularity);
    }
    if (validatedFilters.min_danceability !== undefined) {
      supabaseQuery = supabaseQuery.gte('danceability', validatedFilters.min_danceability);
    }
    if (validatedFilters.max_danceability !== undefined) {
      supabaseQuery = supabaseQuery.lte('danceability', validatedFilters.max_danceability);
    }
    if (validatedFilters.min_energy !== undefined) {
      supabaseQuery = supabaseQuery.gte('energy', validatedFilters.min_energy);
    }
    if (validatedFilters.max_energy !== undefined) {
      supabaseQuery = supabaseQuery.lte('energy', validatedFilters.max_energy);
    }
    if (validatedFilters.min_tempo !== undefined) {
      supabaseQuery = supabaseQuery.gte('tempo', validatedFilters.min_tempo);
    }
    if (validatedFilters.max_tempo !== undefined) {
      supabaseQuery = supabaseQuery.lte('tempo', validatedFilters.max_tempo);
    }

    // Execute the query
    const { data, error } = await supabaseQuery;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        results: [],
        query,
        filters: validatedFilters
      });
    }

    // Calculate similarity scores
    const results = data.map((song: Song) => ({
      song,
      similarity: calculateCosineSimilarity(embedding, song.features)
    }));

    // Sort by similarity score (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    return res.status(200).json({
      results,
      query,
      filters: validatedFilters
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to generate embeddings using FastAPI service
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.vector;
}

// Helper function to calculate cosine similarity
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitude1 * magnitude2);
}

// Helper function to validate and sanitize filters
function validateFilters(filters: Partial<RecommendQueryParams>): RecommendQueryParams {
  const validated: RecommendQueryParams = {
    limit: Math.min(Math.max(1, filters.limit || 10), 50),
  };

  if (filters.genres) {
    validated.genres = Array.isArray(filters.genres) ? filters.genres : [filters.genres];
  }

  // Validate numeric filters
  const numericFilters = [
    'min_popularity', 'max_popularity',
    'min_danceability', 'max_danceability',
    'min_energy', 'max_energy',
    'min_tempo', 'max_tempo'
  ] as const;

  numericFilters.forEach(filter => {
    const value = filters[filter];
    if (typeof value === 'number') {
      (validated as any)[filter] = value;
    }
  });

  return validated;
}