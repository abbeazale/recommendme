// pages/api/recommendations.js
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Song, RecommendQueryParams, RecommendResponse } from '../../types/recommend';

// Frontend-compatible song interface
interface FrontendSong {
  id: string;
  track_name: string;
  artists?: string;
  album_name?: string;
}

// Frontend-compatible response
interface FrontendResponse {
  results: {
    song: FrontendSong;
    similarity: number;
  }[];
  query: string;
  filters: RecommendQueryParams;
}

// Initialize Supabase client with service role for advanced queries
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// FastAPI endpoint for generating embeddings
const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'http://localhost:8000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FrontendResponse | { error: string }>
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

    // Analyze the query to determine the type of search
    const queryAnalysis = analyzeQuery(query);
    console.log("Query analysis:", queryAnalysis);
    
    // Build the database query based on query analysis
    let supabaseQuery = supabase.from('songs').select('*');

    // Get a larger pool of songs for more diverse recommendations
    const poolSize = 2000;
    
    // Apply specific filters based on query analysis
    if (queryAnalysis.artistFilter) {
      supabaseQuery = supabaseQuery.filter('artists', 'ilike', `%${queryAnalysis.artistFilter}%`);
    }
    
    if (queryAnalysis.genreFilter) {
      supabaseQuery = supabaseQuery.filter('track_genre', 'ilike', `%${queryAnalysis.genreFilter}%`);
    }
    
    // User-specified attribute focus gets reflected in ranking later
    
    // Apply user-specified filters
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
    
    // Get data with applied filters
    const { data, error } = await supabaseQuery.limit(poolSize);
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return res.status(200).json({
        results: [],
        query,
        filters: validatedFilters
      } as FrontendResponse);
    }
    
    // Calculate similarity scores and apply attribute weighting based on query analysis
    const results = data.map((song: Song) => {
      // Base similarity from vector embedding comparison
      let similarity = calculateCosineSimilarity(embedding, song.features);
      
      // Apply attribute weightings based on query analysis
      if (queryAnalysis.highEnergy && song.energy > 0.7) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.lowEnergy && song.energy < 0.4) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.danceable && song.danceability > 0.7) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.acoustic && song.acousticness > 0.7) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.upbeat && song.valence > 0.7) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.sad && song.valence < 0.4) {
        similarity += 0.15;
      }
      
      if (queryAnalysis.popular && song.popularity > 70) {
        similarity += 0.1;
      }
      
      // Cap similarity at 1.0
      similarity = Math.min(similarity, 1.0);
      
      return {
        song,
        similarity
      };
    });
    
    // Sort by similarity score (descending)
    results.sort((a: {similarity: number}, b: {similarity: number}) => b.similarity - a.similarity);
    
    // Return only the requested number of results
    const limit = validatedFilters.limit || 10;
    const topResults = results.slice(0, limit);
    
    // Transform the results to match the interface used in index.tsx
    const transformedResults = topResults.map(result => ({
      song: {
        id: String(result.song.id), // Convert to string to match index.tsx interface
        track_name: result.song.track_name,
        artists: Array.isArray(result.song.artists) 
          ? JSON.stringify(result.song.artists) 
          : result.song.artists, // Keep string format from database
        album_name: result.song.album_name
      },
      similarity: result.similarity
    }));

    return res.status(200).json({
      results: transformedResults,
      query,
      filters: validatedFilters
    } as FrontendResponse);
  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to analyze query intent and extract keywords
function analyzeQuery(query: string): {
  artistFilter?: string | undefined;
  genreFilter?: string | undefined;
  highEnergy: boolean;
  lowEnergy: boolean;
  danceable: boolean;
  acoustic: boolean;
  upbeat: boolean;
  sad: boolean;
  popular: boolean;
} {
  const analysis = {
    artistFilter: undefined as string | undefined,
    genreFilter: undefined as string | undefined,
    highEnergy: false,
    lowEnergy: false,
    danceable: false,
    acoustic: false,
    upbeat: false,
    sad: false,
    popular: false
  };
  
  const lowercaseQuery = query.toLowerCase();
  
  // Artist detection
  const artistMatches = [
    /(?:by|from|like) ([a-z0-9 &]+)/i,
    /([a-z0-9 &]+)(?:'s music| songs| tracks)/i
  ];
  
  for (const pattern of artistMatches) {
    const match = lowercaseQuery.match(pattern);
    if (match && match[1]) {
      analysis.artistFilter = match[1].trim();
      break;
    }
  }
  
  // Genre detection
  const genreKeywords = [
    'rock', 'pop', 'hip hop', 'rap', 'country', 'jazz', 'blues', 
    'electronic', 'dance', 'r&b', 'indie', 'folk', 'classical', 
    'metal', 'punk', 'soul', 'reggae', 'disco', 'funk', 'alternative'
  ];
  
  for (const genre of genreKeywords) {
    if (lowercaseQuery.includes(genre)) {
      analysis.genreFilter = genre;
      break;
    }
  }
  
  // Audio attribute analysis
  analysis.highEnergy = ['energetic', 'high energy', 'intense', 'powerful', 'strong'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.lowEnergy = ['calm', 'chill', 'relaxing', 'soft', 'slow', 'mellow'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.danceable = ['dance', 'dancing', 'danceable', 'groovy', 'rhythm'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.acoustic = ['acoustic', 'unplugged', 'instrumental'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.upbeat = ['happy', 'upbeat', 'joyful', 'cheerful', 'positive'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.sad = ['sad', 'melancholy', 'emotional', 'heartbreak', 'depressing'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  analysis.popular = ['popular', 'hit', 'trending', 'top', 'chart'].some(term => 
    lowercaseQuery.includes(term)
  );
  
  return analysis;
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
  // Handle different vector lengths
  const minLength = Math.min(vec1.length, vec2.length);
  
  // Only use the common dimensions
  const dotProduct = Array.from({length: minLength}, (_, i) => vec1[i] * vec2[i])
    .reduce((sum, val) => sum + val, 0);
    
  const magnitude1 = Math.sqrt(
    Array.from({length: minLength}, (_, i) => vec1[i] * vec1[i])
      .reduce((sum, val) => sum + val, 0)
  );
  
  const magnitude2 = Math.sqrt(
    Array.from({length: minLength}, (_, i) => vec2[i] * vec2[i])
      .reduce((sum, val) => sum + val, 0)
  );
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
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