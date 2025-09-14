# core/engine.py
import os
import fitz  # PyMuPDF
from typing import Dict, Any, Tuple

from .extractor import extract_from_pdf, extract_from_image
from .identifier import find_pii
from .redactor import redact_pdf, redact_image, write_on_pdf, write_on_image
from .security import encrypt_text, decrypt_text # <-- IMPORT

def process_and_encrypt_document(file_path: str, severity: int, encryption_key: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Orchestrates the redaction and encryption process.
    - Redacts the visual document with black boxes.
    - Encrypts the underlying PII text.
    - Returns the path to the redacted file AND the encrypted metadata.
    """
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == ".pdf":
        pages_data = extract_from_pdf(file_path)
    elif file_extension in [".png", ".jpg", ".jpeg", ".tiff"]:
        pages_data = extract_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_extension}")

    redaction_visuals = []
    encrypted_metadata = {"pages": {}}

    for page_data in pages_data:
        page_num = page_data["page"]
        words = page_data["words"]
        full_text = " ".join([word[4] for word in words])
        
        pii_locations = find_pii(full_text, severity)
        
        if not pii_locations:
            continue

        encrypted_metadata["pages"][str(page_num)] = []

        char_offset = 0
        word_indices = {}
        for i, word_info in enumerate(words):
            word_text = word_info[4]
            start = char_offset
            end = start + len(word_text)
            word_indices[i] = {'start': start, 'end': end, 'bbox': fitz.Rect(word_info[0:4]), 'text': word_text}
            char_offset = end + 1

        for pii in pii_locations:
            pii_start, pii_end = pii['start'], pii['end']
            
            pii_words_bboxes = []
            pii_plaintext_parts = []
            for i, word_info in word_indices.items():
                if max(pii_start, word_info['start']) < min(pii_end, word_info['end']):
                    pii_words_bboxes.append(word_info['bbox'])
                    pii_plaintext_parts.append(word_info['text'])
            
            if pii_words_bboxes:
                final_bbox = fitz.Rect()
                for bbox in pii_words_bboxes:
                    final_bbox.include_rect(bbox)
                
                pii_plaintext = " ".join(pii_plaintext_parts)
                
                # --- ENCRYPTION STEP ---
                encrypted_text = encrypt_text(encryption_key, pii_plaintext)
                
                encrypted_metadata["pages"][str(page_num)].append({
                    "encrypted_text": encrypted_text.decode('utf-8'),
                    "bbox": [final_bbox.x0, final_bbox.y0, final_bbox.x1, final_bbox.y1]
                })

                if file_extension == ".pdf":
                    redaction_visuals.append((page_num, final_bbox))
                else:
                    redaction_visuals.append(final_bbox)

    # --- VISUAL REDACTION STEP ---
    if not redaction_visuals:
        return file_path, {}

    output_dir = "redacted_files"
    os.makedirs(output_dir, exist_ok=True)
    base_filename = os.path.basename(file_path)
    output_path = os.path.join(output_dir, f"redacted_{base_filename}")

    if file_extension == ".pdf":
        redact_pdf(file_path, redaction_visuals, output_path)
    else:
        redact_image(file_path, redaction_visuals, output_path)

    return output_path, encrypted_metadata


def unredact_document(redacted_file_path: str, encryption_key: bytes, encrypted_metadata: Dict[str, Any]) -> str:
    """
    Orchestrates the process of writing decrypted text back onto a redacted document.
    Returns the path to the fully restored file.
    """
    file_extension = os.path.splitext(redacted_file_path)[1].lower()
    
    restored_data_for_writer = []
    
    # Decrypt all the PII first
    for page_num, pii_items in encrypted_metadata.get("pages", {}).items():
        for item in pii_items:
            try:
                decrypted_text = decrypt_text(encryption_key, item["encrypted_text"].encode('utf-8'))
                bbox = item["bbox"]
                if file_extension == ".pdf":
                    restored_data_for_writer.append((int(page_num), bbox, decrypted_text))
                else:
                    restored_data_for_writer.append((bbox, decrypted_text))
            except ValueError:
                # Handle cases where decryption might fail for a specific item
                print(f"Warning: Could not decrypt an item on page {page_num}.")
                continue
    
    if not restored_data_for_writer:
        raise ValueError("No data could be decrypted or restored.")

    # Define where the final output file will be saved
    output_dir = "restored_files"
    os.makedirs(output_dir, exist_ok=True)
    base_filename = os.path.basename(redacted_file_path).replace("redacted_", "")
    output_path = os.path.join(output_dir, f"restored_{base_filename}")
    
    # Call the appropriate writer function from the redactor module
    if file_extension == ".pdf":
        write_on_pdf(redacted_file_path, restored_data_for_writer, output_path)
    elif file_extension in [".png", ".jpg", ".jpeg", ".tiff"]:
        write_on_image(redacted_file_path, restored_data_for_writer, output_path)
    else:
        raise ValueError(f"Unsupported file type for un-redaction: {file_extension}")
        
    return output_path