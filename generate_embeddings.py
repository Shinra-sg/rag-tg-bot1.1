import psycopg2
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# --- НАСТРОЙКИ ---
DB_NAME = "ragbot"         # Имя базы
DB_USER = "shinra"         # Имя пользователя
DB_PASSWORD = ""           # Пароль
DB_HOST = "localhost"      
DB_PORT = 5432             

# --- КОННЕКТ К БД ---
conn = psycopg2.connect(
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT
)
cur = conn.cursor()

# --- МОДЕЛЬ ---
model = SentenceTransformer('all-MiniLM-L6-v2')

# --- ВЫБОРКА ЧАНКОВ БЕЗ ЭМБЕДДИНГА ---
cur.execute("SELECT id, content FROM instruction_chunks WHERE embedding IS NULL;")
rows = cur.fetchall()

print(f"Найдено чанков без эмбеддинга: {len(rows)}")

for row in tqdm(rows):
    chunk_id, content = row
    emb = model.encode(content)
    emb_list = emb.tolist()
    # Сохраняем эмбеддинг
    cur.execute("UPDATE instruction_chunks SET embedding = %s WHERE id = %s;", (emb_list, chunk_id))

conn.commit()
cur.close()
conn.close()
print("Готово!")
