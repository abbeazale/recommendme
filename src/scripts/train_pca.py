from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
import joblib
import numpy as np
import os

def train_and_save_pca():
    print("Training PCA model for dimensionality reduction...")
    
    # Load the sentence transformer model - same as in main.py
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Create sample texts for training PCA
    # Use a diverse set of music-related texts to cover the domain
    sample_texts = [
        "hip hop music with strong beats",
        "mellow jazz with saxophone",
        "classical piano pieces",
        "energetic rock songs with guitar solos",
        "pop music with catchy chorus",
        "electronic dance music with drops",
        "country songs with acoustic guitar",
        "R&B slow jams",
        "indie folk music",
        "metal with heavy drums",
        "ambient electronic music",
        "reggae with island vibes",
        "songs like Kanye West",
        "albums similar to Dark Side of the Moon",
        "upbeat pop songs with high energy",
        "sad songs for breakups",
        "workout playlist with motivation",
        "relaxing music for studying",
        "party anthems from the 2000s",
        "classic rock from the 70s",
    ]
    
    # Create embeddings
    print("Generating embeddings...")
    embeddings = model.encode(sample_texts)
    
    # Fit PCA model
    print("Fitting PCA model...")
    pca = PCA(n_components=30)
    pca.fit(embeddings)
    
    # Save the fitted model
    output_path = os.path.join(os.path.dirname(__file__), '..', 'python-api', 'pca_model.pkl')
    joblib.dump(pca, output_path)
    print(f"PCA model saved to {output_path}")
    
    # Test the model
    print("Testing the model...")
    test_text = "songs like Kanye"
    test_embedding = model.encode(test_text)
    reduced = pca.transform([test_embedding])
    print(f"Original dimension: {test_embedding.shape}, Reduced dimension: {reduced.shape}")
    print("PCA model trained and saved successfully!")

if __name__ == "__main__":
    train_and_save_pca() 