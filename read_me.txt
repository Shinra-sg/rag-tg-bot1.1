for Postgres{
psql -U shinra -d ragbot
\d instruction_chunks
\q}

for launch parser {npm run start:parser}

for launch tg-bot {npm run start:bot}

test for DB {npx ts-node src/utils/testDb.ts}

for launch embedding {python3 generate_embeddings.py}

launch all {npm run start:all}

lauch admin_bot {npm run start:admin}

launch ollama {ollama serve
               ollama run deepseek-r1}

requirements:
.админку реализовать в тг отдельным боте
.сделать дележку на дерево первого уровня
.условно на документацию по офису технической части и тому подобное 
.доделать фронт на тг
.в конце добавить кнопки для удобства в боте тг