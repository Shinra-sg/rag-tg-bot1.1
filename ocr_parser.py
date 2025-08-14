#!/usr/bin/env python3
import sys
import json
import base64
from PIL import Image
import pytesseract
import easyocr
import io
import os

def extract_text_with_tesseract(image_path):
    """Извлекает текст с изображения используя Tesseract OCR"""
    try:
        # Открываем изображение
        image = Image.open(image_path)
        
        # Настройки для русского языка
        custom_config = r'--oem 3 --psm 6 -l rus+eng'
        
        # Извлекаем текст
        text = pytesseract.image_to_string(image, config=custom_config)
        
        return {
            "success": True,
            "text": text.strip(),
            "method": "tesseract",
            "metadata": {
                "image_size": image.size,
                "image_mode": image.mode,
                "image_format": image.format
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "method": "tesseract"
        }

def extract_text_with_easyocr(image_path):
    """Извлекает текст с изображения используя EasyOCR"""
    try:
        # Инициализируем EasyOCR с русским и английским языками
        reader = easyocr.Reader(['ru', 'en'])
        
        # Читаем текст с изображения
        results = reader.readtext(image_path)
        
        # Объединяем все найденные тексты
        text = ' '.join([result[1] for result in results])
        
        return {
            "success": True,
            "text": text.strip(),
            "method": "easyocr",
            "metadata": {
                "detected_blocks": len(results),
                "confidence_scores": [result[2] for result in results]
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "method": "easyocr"
        }

def process_image(image_path):
    """Обрабатывает изображение и возвращает распознанный текст"""
    # Проверяем существование файла
    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Файл не найден: {image_path}"
        }
    
    # Пробуем сначала Tesseract (быстрее)
    result = extract_text_with_tesseract(image_path)
    
    # Если Tesseract не сработал или текст пустой, пробуем EasyOCR
    if not result["success"] or not result["text"]:
        result = extract_text_with_easyocr(image_path)
    
    # Если оба метода не сработали
    if not result["success"] or not result["text"]:
        return {
            "success": False,
            "error": "Не удалось распознать текст с изображения",
            "tesseract_result": extract_text_with_tesseract(image_path),
            "easyocr_result": extract_text_with_easyocr(image_path)
        }
    
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Использование: python ocr_parser.py <путь_к_изображению>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = process_image(image_path)
    
    # Выводим ТОЛЬКО JSON результат без дополнительных сообщений
    print(json.dumps(result, ensure_ascii=False, indent=2))
