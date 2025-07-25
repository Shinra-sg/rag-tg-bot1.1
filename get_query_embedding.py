import sys
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')
query = sys.argv[1]
emb = model.encode(query)
print(','.join(str(x) for x in emb.tolist()))
