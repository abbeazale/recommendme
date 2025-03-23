import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sentence_transformers import SentenceTransformer
from collections import Counter
import logging
logging.basicConfig(level=logging.DEBUG)

# Load the dataset
df = pd.read_csv('nosamesongs.csv')

# Add ID column starting from 1
df['id'] = range(1, len(df) + 1)

# Remove any duplicate header rows if present
if df.iloc[0].equals(pd.Series(df.columns)):
    df = df.iloc[1:].reset_index(drop=True)

# Convert all numeric columns to float
numeric_cols = ['popularity', 'duration_ms', 'danceability', 'energy', 
                'loudness', 'speechiness', 'acousticness', 
                'instrumentalness', 'liveness', 'valence', 'tempo']

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')

# Handle missing values (impute with mean before standardization)
df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())

# Standardize numeric columns
scaler = StandardScaler()
normalized_values = scaler.fit_transform(df[numeric_cols])
for i, col in enumerate(numeric_cols):
    df[f'{col}_norm'] = normalized_values[:, i]

# Convert explicit to binary
df['explicit_norm'] = df['explicit'].map({True: 1, False: 0, 'True': 1, 'False': 0})

def convert_artists_to_array(artist_string):
    if pd.isna(artist_string) or not isinstance(artist_string, str):
        return []
    if '[' in artist_string and ']' in artist_string:
        artist_string = artist_string.strip('[]').replace('"', '').replace("'", '')
    # Split on semicolons first, then optionally on commas within each part
    artists = []
    for part in artist_string.split(';'):
        artists.extend([a.strip() for a in part.split(',') if a.strip()])
    return artists

df['artists'] = df['artists'].apply(convert_artists_to_array)

# Load pre-trained embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Safe encoding for artists
def safe_encode(artist_list):
    try:
        text = ' '.join([str(a) for a in artist_list if a])
        return model.encode(text).tolist() if text else [0.0] * 384
    except Exception as e:
        print(f"Error encoding {artist_list}: {e}")
        return [0.0] * 384

df['artists_vector'] = df['artists'].apply(
    lambda x: (
        logging.debug(f"Encoding artists: {x}"),
        safe_encode(x)
    )[1]
)

# Safe encoding for track_genre
def safe_genre_encode(genre):
    try:
        return model.encode(str(genre)).tolist() if pd.notna(genre) and str(genre).strip() else [0.0] * 384
    except Exception as e:
        print(f"Error encoding genre {genre}: {e}")
        return [0.0] * 384

df['track_genre_vector'] = df['track_genre'].apply(safe_genre_encode)

# One-hot encoding for album_name and track_name
def text_to_embedding(text, all_values, max_values=10):
    if pd.isna(text) or not isinstance(text, str):
        return [0.0] * max_values
    embedding = [0.0] * max_values
    if text in all_values:
        idx = all_values.index(text)
        if idx < max_values:
            embedding[idx] = 1.0
    return embedding

top_albums = [a for a, _ in Counter(df['album_name'].fillna('')).most_common(10)]
top_tracks = [a for a, _ in Counter(df['track_name'].fillna('')).most_common(10)]
df['album_name_vector'] = df['album_name'].apply(lambda x: text_to_embedding(x, top_albums))
df['track_name_vector'] = df['track_name'].apply(lambda x: text_to_embedding(x, top_tracks))

# Define weights for numeric features
weights = {
    'danceability_norm': 2.0,
    'energy_norm': 2.0,
    'loudness_norm': 1.0,
    'speechiness_norm': 1.0,
    'acousticness_norm': 2.0,
    'instrumentalness_norm': 1.0,
    'liveness_norm': 1.0,
    'valence_norm': 2.0,  # Increased to match your update
    'tempo_norm': 1.5,
    'duration_ms_norm': 0.5,
    'explicit_norm': 0.5,
    'popularity_norm': 0.5,
    'artists_vector': 2.0,  
    'track_genre_vector': 2.0 
}

# Create the features array
df['features'] = df.apply(lambda row: 
    [
        float(row['danceability_norm']) * weights['danceability_norm'],
        float(row['energy_norm']) * weights['energy_norm'],
        float(row['loudness_norm']) * weights['loudness_norm'],
        float(row['speechiness_norm']) * weights['speechiness_norm'],
        float(row['acousticness_norm']) * weights['acousticness_norm'],
        float(row['instrumentalness_norm']) * weights['instrumentalness_norm'],
        float(row['liveness_norm']) * weights['liveness_norm'],
        float(row['valence_norm']) * weights['valence_norm'],
        float(row['tempo_norm']) * weights['tempo_norm'],
        float(row['duration_ms_norm']) * weights['duration_ms_norm'],
        float(row['explicit_norm']) * weights['explicit_norm'],
        float(row['popularity_norm']) * weights['popularity_norm'],
    ] + 
    [x * weights['artists_vector'] for x in row['artists_vector'][:20]] +  # Weighted artist embedding
    [x * weights['track_genre_vector'] for x in row['track_genre_vector'][:20]] +  # Weighted genre embedding
    [float(x) for x in row['album_name_vector']] +
    [float(x) for x in row['track_name_vector']],
    axis=1
)

# Convert features to numpy array
df['features'] = df['features'].apply(lambda x: np.array(x, dtype=float))

#use PCA to reduce dimentions
feature_matrix = np.vstack(df['features'].values)
pca = PCA(n_components=30) #reduce to 30 dimensions
reduced_features = pca.fit_transform(feature_matrix)
df['features'] = [row.tolist() for row in reduced_features]

# Print explained variance to assess information retention
explained_variance_ratio = pca.explained_variance_ratio_.sum()
print(f"Explained variance ratio with 30 components: {explained_variance_ratio:.4f}")


# Verify feature vector length
vector_length = len(df['features'].iloc[0])
print(f"Feature vector length: {vector_length}")  # Should be 12 + 20 + 20 + 10 + 10 = 72

# Clean up and organize columns
columns_to_keep = ['id', 'album_name', 'track_name', 'artists', 'track_genre', 
                  'popularity', 'duration_ms', 'explicit', 'features'] + numeric_cols
columns_to_keep = [col for col in columns_to_keep if col in df.columns]
df = df[columns_to_keep]

# Convert artists back to string representation for storage
df['artists'] = df['artists'].apply(lambda x: '[' + ','.join([f'"{a}"' for a in x]) + ']')

# Save the final dataset
df.to_csv('processed_songs_for_pgvector.csv', index=False)
print("Data processing completed and saved to processed_songs_for_pgvector.csv")