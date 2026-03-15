import fitz  
from PIL import Image
import pytesseract
from typing import List, Dict, Any

def extract_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text and bounding boxes from a PDF."""
    document_data = []
    doc = fitz.open(file_path)
    for page_num, page in enumerate(doc):
        words = page.get_text("words")
        document_data.append({"page": page_num, "words": words})
    return document_data


def extract_from_image(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text and bounding boxes from an image using OCR."""
    try:
        data = pytesseract.image_to_data(Image.open(file_path), output_type=pytesseract.Output.DICT)
        words = []
        n_boxes = len(data['level'])
        for i in range(n_boxes):
            if int(data['conf'][i]) > 60: 
                (x, y, w, h) = (data['left'][i], data['top'][i], data['width'][i], data['height'][i])
                word = data['text'][i]
                if word.strip():
                    words.append([x, y, x + w, y + h, word])
        
        return [{"page": 0, "words": words}]

    except Exception as e:
        print(f"Error during OCR: {e}")
        return []