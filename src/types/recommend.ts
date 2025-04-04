// Song interface representing the database schema
export interface Song {
  id: number;
  album_name: string;
  track_name: string;
  artists: string[];
  track_genre: string;
  popularity: number;
  duration_ms: number;
  explicit: boolean;
  features: number[]; // Vector embeddings
  danceability: number;
  energy: number;
  loudness: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
}

// Query parameters for filtering and pagination
export interface RecommendQueryParams {
  limit?: number;
  min_popularity?: number;
  max_popularity?: number;
  genres?: string[];
  min_danceability?: number;
  max_danceability?: number;
  min_energy?: number;
  max_energy?: number;
  min_tempo?: number;
  max_tempo?: number;
}

// Response type for the recommendation endpoint
export interface RecommendResponse {
  results: {
    song: Song;
    similarity: number;
  }[];
  query: string;
  filters: RecommendQueryParams;
} 