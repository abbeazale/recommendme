import pandas as pd
import ast
import word2vec
import csv
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
# Load the dataset
df = pd.read_csv('songsdata.csv')

# Remove the first row if it's a header row that was duplicated
# If the first row is actually data row with index 0, skip this step
df = df.iloc[1:].reset_index(drop=True)

# Convert scientifically notated values to float
# Pandas should handle this automatically, but we can ensure it:
numeric_cols = ['popularity', 'duration_ms', 'danceability', 'energy', 
                'loudness', 'speechiness', 'acousticness', 
                'instrumentalness', 'liveness', 'valence', 'tempo']

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')

# Normalize all numeric columns
for col in numeric_cols:
    df[f'{col}_norm'] = (df[col] - df[col].min()) / (df[col].max() - df[col].min())


# 3. For explicit (boolean) - convert to numeric
if 'explicit' in df.columns:
    df['explicit_norm'] = df['explicit'].map({True: 1, False: 0})

# Create a features array with only normalized numeric features
df['features'] = df.apply(lambda row: [
    row['danceability_norm'],
    row['energy_norm'],
    row['loudness_norm'],
    row['speechiness_norm'],
    row['acousticness_norm'],
    row['instrumentalness_norm'],
    row['liveness_norm'],
    row['valence_norm'],
    row['tempo_norm'],
    row['duration_ms_norm'],
    row['explicit_norm'],
    row['popularity_norm'] * 0.3  
], axis=1)

# Check summary statistics
print(df[[col + '_norm' for col in numeric_cols]].describe())

# Check for missing values
print(df[numeric_cols].isnull().sum())
print(df['artists'].isna().sum())
print(df['artists'].apply(type).value_counts())


def convert_to_postgres_array(artist_string):
    # Handle NaN, None, or other non-string values
    if pd.isna(artist_string) or not isinstance(artist_string, str):
        return "[]"  # Return empty array for missing values
    
    # Split by semicolon
    artists = artist_string.split(';')
    
    # Trim whitespace and add quotes around each artist without using f-strings
    formatted_artists = []
    for artist in artists:
        formatted_artists.append(f'"{artist.strip()}"')
    
    # Join with commas and wrap in square brackets
    return "[" + ",".join(formatted_artists) + "]"

# Apply conversion
df['artists_array'] = df['artists'].apply(convert_to_postgres_array)

# VECTORIZE TEXT FIELDS
# First, ensure text fields are strings
text_fields = ['artists', 'album_name', 'track_name', 'track_genre']
for field in text_fields:
    if field in df.columns:
        df[field] = df[field].fillna('').astype(str)

# Create vectorized versions of text fields
vectorizers = {}
for field in text_fields:
    if field in df.columns:
        # Create a TF-IDF vectorizer
        vectorizer = TfidfVectorizer(max_features=10)  # Limit to 10 features per field
        vectorizers[field] = vectorizer
        
        # Fit and transform the text data
        text_vectors = vectorizer.fit_transform(df[field])
        
        # Convert sparse matrix to dense array and then to list
        vectors_as_lists = text_vectors.toarray().tolist()
        
        # Store the vectors in a new column
        df[f'{field}_vector'] = vectors_as_lists

# Delete the artists column
df.drop(columns=['artists'], inplace=True)

# Rename 'artists_array' to 'artists'
df.rename(columns={'artists_array': 'artists'}, inplace=True)

# Check if 'Unnamed: 0' exists before trying to drop it
if 'Unnamed: 0' in df.columns:
    df.drop(columns=['Unnamed: 0'], inplace=True)

df.to_csv('artistarrayfinal.csv', index=False) 
