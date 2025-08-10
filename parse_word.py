#!/usr/bin/env python3
"""
Парсер для Word файлов (.docx, .doc)
"""

import sys
import json
import os
from docx import Document
from datetime import datetime

def parse_word_file(file_path):
    """Парсит Word файл и возвращает содержимое в JSON формате"""
    try:
        # Загружаем документ
        doc = Document(file_path)
        
        content_parts = []
        metadata = {
            "title": os.path.basename(file_path),
            "author": None,
            "pages": None,
            "created": None,
            "modified": None
        }
        
        # Получаем метаданные
        if hasattr(doc.core_properties, 'author') and doc.core_properties.author:
            metadata["author"] = doc.core_properties.author
        
        if hasattr(doc.core_properties, 'created') and doc.core_properties.created:
            metadata["created"] = doc.core_properties.created.isoformat()
        
        if hasattr(doc.core_properties, 'modified') and doc.core_properties.modified:
            metadata["modified"] = doc.core_properties.modified.isoformat()
        
        # Обрабатываем параграфы
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                content_parts.append(paragraph.text)
        
        # Обрабатываем таблицы
        for table in doc.tables:
            content_parts.append("=== Таблица ===")
            for row in table.rows:
                row_text = " | ".join(cell.text for cell in row.cells)
                if row_text.strip():
                    content_parts.append(row_text)
            content_parts.append("")
        
        # Объединяем содержимое
        content = "\n".join(content_parts)
        
        # Примерная оценка количества страниц (1 страница ≈ 500 символов)
        if content:
            metadata["pages"] = max(1, len(content) // 500)
        
        return {
            "content": content,
            "metadata": metadata
        }
        
    except Exception as e:
        return {
            "content": f"Ошибка при обработке Word файла: {str(e)}",
            "metadata": {}
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Необходимо указать путь к файлу"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"Файл не найден: {file_path}"}))
        sys.exit(1)
    
    result = parse_word_file(file_path)
    print(json.dumps(result, ensure_ascii=False, indent=2)) 