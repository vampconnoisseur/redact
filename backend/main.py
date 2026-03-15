import os
import shutil
import uuid
import json
from base64 import urlsafe_b64encode, urlsafe_b64decode
from typing import Dict, Any, Literal, List 

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

from core.engine import process_document_llm, process_document_classic, unredact_document
from core.security import generate_key, decrypt_text

app = FastAPI(title="Dual-Engine Document Redaction Service")

origins = [ "http://localhost:3000", "*" ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_UPLOADS_DIR = "temp_uploads"
os.makedirs(TEMP_UPLOADS_DIR, exist_ok=True)

class DecryptionRequest(BaseModel):
    document_id: str
    decryption_key: str

class DecryptedPiiItem(BaseModel):
    text: str
    bbox: List[float]

class DecryptionResponse(BaseModel):
    document_id: str
    pages: Dict[str, List[DecryptedPiiItem]]


def cleanup_files(files: list):
    for file_path in files:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                print(f"Error cleaning up file {file_path}: {e}")

@app.post("/process/", summary="Process a document with chosen engine", tags=["Processing"])
async def process_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    severity: int = Form(...),
    engine: Literal['classic', 'llm'] = Form(...)
):
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    input_path = os.path.join(TEMP_UPLOADS_DIR, unique_filename)
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    key = generate_key()
    
    try:
        if engine == 'llm':
            redacted_file_path, encrypted_metadata = process_document_llm(input_path, severity, key)
        else:
            redacted_file_path, encrypted_metadata = process_document_classic(input_path, severity, key)
        
        with open(redacted_file_path, "rb") as f:
            redacted_file_bytes = f.read()
            
        background_tasks.add_task(cleanup_files, [input_path, redacted_file_path])
        
        return JSONResponse(content={
            "decryptionKey": urlsafe_b64encode(key).decode('utf-8'),
            "encryptedMetadata": encrypted_metadata,
            "redactedFile": urlsafe_b64encode(redacted_file_bytes).decode('utf-8'),
            "contentType": file.content_type,
        })
    except Exception as e:
        background_tasks.add_task(cleanup_files, [input_path])
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.post("/unredact/", summary="Restore a redacted document", tags=["Processing"])
async def unredact_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    decryption_key: str = Form(...),
    encrypted_metadata_json: str = Form(...),
    password: str = Form(None)
) -> FileResponse:
    encrypted_metadata = json.loads(encrypted_metadata_json)
    try:
        key = urlsafe_b64decode(decryption_key)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid key format.")

    temp_redacted_path = os.path.join(TEMP_UPLOADS_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(temp_redacted_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        restored_file_path = unredact_document(temp_redacted_path, key, encrypted_metadata, password)
        
        background_tasks.add_task(cleanup_files, [temp_redacted_path, restored_file_path])
        
        return FileResponse(
            path=restored_file_path,
            media_type=file.content_type,
            filename=f"restored_{file.filename.replace('redacted_', '')}"
        )
    except Exception as e:
        background_tasks.add_task(cleanup_files, [temp_redacted_path])
        raise HTTPException(status_code=500, detail=f"An error during un-redaction: {str(e)}")