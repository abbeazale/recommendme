const EMBEDDING_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.vector;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}