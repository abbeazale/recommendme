import pandas as pd
import re

# Load the CSV file
df = pd.read_csv('processed_songs_for_pgvector.csv')

# Clean up the features column to format properly for pgvector
def format_vector_for_pgvector(vector_str):
    if isinstance(vector_str, str):
        # Extract all numbers using regex (handles scientific notation)
        numbers = re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?', vector_str)
        # Convert to float and join with commas in brackets
        return '[' + ','.join(str(float(num)) for num in numbers) + ']'
    return '[0]'  # Default empty vector

# Apply the formatting function
df['features'] = df['features'].apply(format_vector_for_pgvector)

# Make sure artists is also properly formatted
def format_artists_for_postgres(artists_str):
    if isinstance(artists_str, str):
        # If already looks like an array, return it
        if artists_str.startswith('[') and artists_str.endswith(']'):
            # Make sure internal format uses commas not semicolons
            cleaned = artists_str.replace(';', ',')
            return cleaned
        # Otherwise, split by semicolon and format
        artists = artists_str.split(';')
        return '[' + ','.join(f'"{a.strip()}"' for a in artists) + ']'
    return '[]'  # Empty array

df['artists'] = df['artists'].apply(format_artists_for_postgres)

# Keep only necessary columns
columns_to_keep = [
    'id', 'album_name', 'track_name', 'artists', 'track_genre', 
    'popularity', 'duration_ms', 'explicit', 'features'
]

# Only keep columns that exist
columns_to_keep = [col for col in columns_to_keep if col in df.columns]
df_clean = df[columns_to_keep]


# Save the cleaned CSV
df_clean.to_csv('cleaned_for_import.csv', index=False)