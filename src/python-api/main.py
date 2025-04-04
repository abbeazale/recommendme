from fastapi import FastAPI, Request
from pydantic import BaseModel
import joblib
from sentence_transformers import SentenceTransformer
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Set up CORS to allow requests from your Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the sentence transformer model
model = SentenceTransformer("all-MiniLM-L6-v2")

class QueryInput(BaseModel):
    text: str

@app.post("/embed")
async def embed_query(data: QueryInput):
    # Generate embedding directly without PCA reduction
    embedding = model.encode(data.text)
    return {"vector": embedding.tolist()}