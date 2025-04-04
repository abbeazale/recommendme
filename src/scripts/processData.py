import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, normalize
from sklearn.decomposition import PCA
from sentence_transformers import SentenceTransformer
import logging
import joblib
import json

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

# Consistent text embedding function for all text fields
def get_text_embedding(text):
    try:
        if pd.isna(text) or not isinstance(text, str) or not text.strip():
            return [0.0] * 384  # Same dimensionality as the model output
        return model.encode(str(text)).tolist()
    except Exception as e:
        logging.error(f"Error encoding text '{text}': {e}")
        return [0.0] * 384

# Safe encoding for artists
def safe_encode(artist_list):
    try:
        text = ' '.join([str(a) for a in artist_list if a])
        return model.encode(text).tolist() if text else [0.0] * 384
    except Exception as e:
        logging.error(f"Error encoding {artist_list}: {e}")
        return [0.0] * 384

df['artists_vector'] = df['artists'].apply(
    lambda x: (
        logging.debug(f"Encoding artists: {x}"),
        safe_encode(x)
    )[1]
)

# Safe encoding for track_genre
df['track_genre_vector'] = df['track_genre'].apply(get_text_embedding)

# Replace one-hot encoding with semantic embeddings for album and track names
df['album_name_vector'] = df['album_name'].apply(get_text_embedding)
df['track_name_vector'] = df['track_name'].apply(get_text_embedding)

# Define weights for all features
weights = {
    'danceability_norm': 2.0,
    'energy_norm': 2.0,
    'loudness_norm': 1.0,
    'speechiness_norm': 1.0,
    'acousticness_norm': 2.0,
    'instrumentalness_norm': 1.0,
    'liveness_norm': 1.0,
    'valence_norm': 2.0,
    'tempo_norm': 1.5,
    'duration_ms_norm': 0.5,
    'explicit_norm': 0.5,
    'popularity_norm': 0.5,
    'artists_vector': 2.0,  
    'track_genre_vector': 2.0,
    'album_name_vector': 1.0,  
    'track_name_vector': 1.0 
}

# Apply PCA to each text embedding type separately to reduce dimensionality
def reduce_embedding(vectors, n_components=20):
    if len(vectors) <= n_components:
        # If fewer samples than components, pad with zeros
        return [v[:n_components] + [0.0] * (n_components - len(v[:n_components])) for v in vectors]
    matrix = np.vstack(vectors)
    pca = PCA(n_components=n_components)
    reduced = pca.fit_transform(matrix)
    return [row.tolist() for row in reduced]

# Reduce dimensionality of text embeddings before combining
reduced_artists = reduce_embedding(df['artists_vector'].tolist())
df['artists_vector_reduced'] = reduced_artists

reduced_genres = reduce_embedding(df['track_genre_vector'].tolist())
df['track_genre_vector_reduced'] = reduced_genres

reduced_albums = reduce_embedding(df['album_name_vector'].tolist())
df['album_name_vector_reduced'] = reduced_albums

reduced_tracks = reduce_embedding(df['track_name_vector'].tolist())
df['track_name_vector_reduced'] = reduced_tracks

# Create the features array with reduced embeddings
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
    [x * weights['artists_vector'] for x in row['artists_vector_reduced']] +
    [x * weights['track_genre_vector'] for x in row['track_genre_vector_reduced']] +
    [x * weights['album_name_vector'] for x in row['album_name_vector_reduced']] +
    [x * weights['track_name_vector'] for x in row['track_name_vector_reduced']],
    axis=1
)

# Convert features to numpy array
feature_matrix = np.vstack(df['features'].values)

# Final PCA to reduce dimensions
pca = PCA(n_components=30)
reduced_features = pca.fit_transform(feature_matrix)
joblib.dump(pca, 'pca_model.pkl')

# Normalize the final vectors for cosine similarity
normalized_features = normalize(reduced_features, norm='l2', axis=1)
df['features'] = [row.tolist() for row in normalized_features]

# Print explained variance to assess information retention
explained_variance_ratio = pca.explained_variance_ratio_.sum()
print(f"Explained variance ratio with 30 components: {explained_variance_ratio:.4f}")

# Verify feature vector length
vector_length = len(df['features'].iloc[0])
print(f"Feature vector length: {vector_length}")  # Should be 30

# Clean up and organize columns
columns_to_keep = ['id', 'album_name', 'track_name', 'artists', 'track_genre', 
                  'popularity', 'duration_ms', 'explicit', 'features'] + numeric_cols
columns_to_keep = [col for col in columns_to_keep if col in df.columns]
df = df[columns_to_keep]

# Convert artists to proper JSON strings
df['artists'] = df['artists'].apply(json.dumps)

# Save the final dataset
df.to_csv('processed_songs_for_pgvector.csv', index=False)
print("Data processing completed and saved to processed_songs_for_pgvector.csv")