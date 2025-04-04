import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { supabase } from "@/backend/supabase";
import { useState } from "react";
import { getEmbedding } from '@/utils/api';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define an interface for song data
interface Song {
  id: string;
  track_name: string;
  artists?: string;
  album_name?: string;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      // 1. Get embedding vector from your Python API
      const vector = await getEmbedding(searchTerm);
      
      // 2. Use the vector to query your API endpoint
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchTerm,
          filters: {
            limit: 10,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Recommendation API error: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results.map((item: any) => item.song));
      
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to fetch recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-gradient-to-b from-gray-900 to-black text-white`}
    >
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            SoundSync
          </h1>
          <p className="text-xl text-gray-300">
            Discover your next favorite song with our AI-powered recommendations
          </p>
        </header>

        <div className="max-w-3xl mx-auto mb-16">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search by song, artist, or album..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-4 text-lg bg-gray-800 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
            <button 
              type="submit"
              disabled={isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-purple-500 to-pink-600 text-white p-3 rounded-full hover:opacity-90 transition"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="text-red-400 text-center mb-8">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-purple-300">Recommended Songs</h2>
            <ul className="space-y-4">
              {results.map((song) => (
                <li key={song.id} className="border-b border-gray-700 pb-4 last:border-0">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center text-purple-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="font-bold text-white">{song.track_name}</h3>
                      <p className="text-gray-400">{song.artists?.replace(/[\[\]"]/g, '')}</p>
                      <p className="text-gray-500 text-sm">{song.album_name}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="text-center mt-20 text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} SoundSync. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
