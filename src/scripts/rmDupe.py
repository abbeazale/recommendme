import pandas as pd

# Load the original dataset
print("Loading dataset...")
df = pd.read_csv('songsdata.csv')

# Check original shape
original_shape = df.shape
print(f"Original dataset shape: {original_shape} (rows, columns)")

# Check for duplicate rows based on track_name and artists
# These are the most important fields to identify a duplicate song
print("Finding duplicates...")
if 'track_id' in df.columns:
    # If track_id exists, it's a unique identifier, use it
    duplicates = df.duplicated(subset=['track_id'], keep='first')
else:
    # Otherwise use track name and artists as identifiers
    duplicates = df.duplicated(subset=['track_name', 'artists'], keep='first')

print(f"Found {duplicates.sum()} duplicate rows")

# Remove duplicates
df_no_duplicates = df.drop_duplicates(
    subset=['track_name', 'artists'], 
    keep='first'
)

# Check shape after removing duplicates
new_shape = df_no_duplicates.shape
print(f"New dataset shape: {new_shape} (rows, columns)")
print(f"Removed {original_shape[0] - new_shape[0]} duplicate rows")

# Save to new CSV
print("Saving clean dataset to nosamesongs.csv...")
df_no_duplicates.to_csv('nosamesongs.csv', index=False)
print("Done!")

# Optional: print example duplicates for verification
if duplicates.sum() > 0:
    print("\nExample of duplicates that were removed:")
    duplicate_indices = duplicates[duplicates].index
    if 'track_name' in df.columns and 'artists' in df.columns:
        for idx in duplicate_indices[:5]:  # Show max 5 examples
            track = df.loc[idx, 'track_name']
            artist = df.loc[idx, 'artists']
            print(f"- '{track}' by {artist}")
