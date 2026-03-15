import os
import fitz  
from PIL import Image, ImageDraw
from typing import List, Tuple

def redact_pdf(file_path: str, redaction_boxes: List[Tuple[int, fitz.Rect]], output_path: str):
    """
    Applies solid, opaque, black redaction boxes to a PDF.
    This method guarantees 100% coverage of the redacted area.
    """
    doc = fitz.open(file_path)
    for page_num, bbox in redaction_boxes:
        page = doc[page_num]

        page.add_redact_annot(
            bbox,
            fill=(0, 0, 0)  
        )
        page.apply_redactions()
    doc.save(output_path, garbage=4, clean=True)
    doc.close()

def redact_image(file_path: str, redaction_boxes: List[fitz.Rect], output_path: str):
    """
    Draws solid, opaque, black boxes over specified areas in an image.
    This method guarantees 100% coverage of the redacted area.
    """
    image = Image.open(file_path).convert("RGB")
    draw = ImageDraw.Draw(image)

    for bbox in redaction_boxes:
        box_coords = (bbox.x0, bbox.y0, bbox.x1, bbox.y1)
        draw.rectangle(box_coords, fill="black")
            
    image.save(output_path)


def write_on_pdf(file_path: str, restored_data: list, output_path: str, password: str = None):
    """
    Writes decrypted text back onto a redacted PDF.
    restored_data is a list of tuples: (page_num, bbox, text).
    """
    doc = fitz.open(file_path)
    
    for page_num, bbox_coords, text in restored_data:
        page = doc[page_num]
        bbox = fitz.Rect(bbox_coords)
        page.draw_rect(bbox, color=(1, 1, 1), fill=(1, 1, 1))
        bbox_height = bbox.height
        font_size = int(bbox_height * 0.6)
        font_size = max(font_size, 6)
        page.insert_text(
            bbox.bl + (2, -2),
            text,
            fontsize=font_size,
            fontname="helv",
            color=(0, 0, 0),
        )
    
    if password:
        doc.save(output_path, encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw=password, user_pw=password, permissions=fitz.PDF_PERM_ACCESSIBILITY)
    else:
        doc.save(output_path)
        
    doc.close()

def write_on_image(file_path: str, restored_data: list, output_path: str):
    """
    Writes decrypted text back onto a redacted image.
    restored_data is a list of tuples: (bbox, text).
    """
    image = Image.open(file_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    
    try:
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  
            "/System/Library/Fonts/SFNSDisplay.ttf",  
            "C:/Windows/Fonts/Arial.ttf"  
        ]
        
        font = None
        for font_path in font_paths:
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, 12)
                break
        
        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    for bbox_coords, text in restored_data:
        x0, y0, x1, y1 = bbox_coords
        box_width = x1 - x0
        box_height = y1 - y0
        
        draw.rectangle(bbox_coords, fill="white")
        
        font_size = int(box_height * 0.6)
        font_size = max(font_size, 8)  
        
        try:
            if hasattr(font, 'path'):
                current_font = ImageFont.truetype(font.path, font_size)
            else:
                current_font = ImageFont.load_default()
        except:
            current_font = ImageFont.load_default()
        
        try:
            text_bbox = draw.textbbox((0, 0), text, font=current_font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            x_pos = x0 + (box_width - text_width) / 2
            y_pos = y0 + (box_height - text_height) / 2
            
            draw.text((x_pos, y_pos), text, fill="black", font=current_font)
        except:
            draw.text((x0 + 2, y0 + 2), text, fill="black", font=current_font)
    
    image.save(output_path)