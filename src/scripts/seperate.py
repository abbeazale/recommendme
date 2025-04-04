import pandas as pd

# Load the original CSV file
df = pd.read_csv('cleaned_for_import.csv')
# Define the number of rows per file
rows_per_file = 25000

# Calculate the total number of chunks/files
num_files = len(df) // rows_per_file + (1 if len(df) % rows_per_file != 0 else 0)

# Loop through the DataFrame and save each chunk as a new CSV file
for i in range(num_files):
    start_index = i * rows_per_file
    end_index = start_index + rows_per_file
    chunk = df.iloc[start_index:end_index]
    chunk.to_csv(f'file_part_{i+1}.csv', index=False)
    
print(f"Data split into {num_files} files with up to {rows_per_file} rows each.")
