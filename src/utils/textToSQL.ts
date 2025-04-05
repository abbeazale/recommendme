// src/utils/textToSql.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateSQLQuery(nlQuery: string): Promise<string> {
  try {
    // Define a prompt explaining your schema and what SQL you need
    const prompt = `
I have a PostgreSQL table named "songs" with the following columns:
- id (integer)
- album_name (text)
- track_name (text)
- artists (text[])  -- an array of artist names
- track_genre (text)
- popularity (numeric)
- duration_ms (numeric)
- explicit (boolean)
- features (vector(30))  -- a 30-dimensional feature vector

I need you to analyze this natural language query and generate a PostgreSQL query that matches this exact format:

SET ivfflat.probes = 10;
SELECT id, track_name, artists, track_genre, features <-> (
    SELECT AVG(features) 
    FROM songs 
    WHERE 'Artist' = ANY(artists)
) AS similarity
FROM songs
ORDER BY similarity
LIMIT 10;

The user query is: "${nlQuery}"

Important:
1. Replace 'Artist' with the artist name mentioned in the query.
2. Keep the SET ivfflat.probes = 10; line exactly as shown.
3. If no artist is mentioned, try to understand what the user is looking for (genre, mood, etc.) and modify the inner query accordingly.
4. For genre-based queries, use: WHERE track_genre ILIKE '%genre%'
5. Always use the <-> operator exactly as shown (this is the correct PostgreSQL vector operator).
6. Do not add any extra WHERE clauses to the outer query.

Return only the SQL query, no explanations or markdown.
`;

    // Use Gemini to generate the content based on the prompt.
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    
    if (!response || !response.text) {
      console.error("Error: Gemini API returned empty response for query:", nlQuery);
      return `SET ivfflat.probes = 10;
SELECT id, track_name, artists, track_genre, features <-> (
    SELECT AVG(features) 
    FROM songs 
    WHERE 'Artist' = ANY(artists)
) AS similarity
FROM songs
ORDER BY similarity
LIMIT 10;`;
    }
    
    console.log("Gemini response for query:", nlQuery);
    console.log("Raw Generated SQL:", response.text);
    
    // Remove markdown code fences if present
    let generatedSQL = response.text.trim();
    if (generatedSQL.startsWith("```")) {
      // Remove starting and ending ``` markers (and any language specifier)
      generatedSQL = generatedSQL.replace(/^```(?:sql)?\s*/, "").replace(/\s*```$/, "").trim();
    }
    
    console.log("Cleaned SQL:", generatedSQL);
    
    // Ensure the correct vector operator is used regardless of what was generated
    generatedSQL = generatedSQL.replace(/<=>|<=>>/g, '<->');
    
    // Fallback in case the cleaning results in an empty query
    if (!generatedSQL) {
      generatedSQL = `SET ivfflat.probes = 10;
SELECT id, track_name, artists, track_genre, features <-> (
    SELECT AVG(features) 
    FROM songs 
    WHERE 'Artist' = ANY(artists)
) AS similarity
FROM songs
ORDER BY similarity
LIMIT 10;`;
    }
    
    return generatedSQL;
    
  } catch (error) {
    console.error("Error generating SQL query:", error);
    // Return a fallback query in case of error
    return `SET ivfflat.probes = 10;
SELECT id, track_name, artists, track_genre, features <-> (
    SELECT AVG(features) 
    FROM songs 
    WHERE 'Artist' = ANY(artists)
) AS similarity
FROM songs
ORDER BY similarity
LIMIT 10;`;
  }
}

// Keep this interface for backward compatibility
export interface FilterCondition {
  filter: string;
  operator: string;
  value: string | number | boolean;
}

// This is kept for backward compatibility
export async function generateFilterConditions(nlQuery: string): Promise<FilterCondition[]> {
  console.warn("generateFilterConditions is deprecated, using direct SQL generation instead");
  return [];
}