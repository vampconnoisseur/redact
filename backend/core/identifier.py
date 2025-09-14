# core/identifier.py
import re
import spacy
from typing import List, Dict

# Load the spaCy model once
nlp = spacy.load("en_core_web_sm")

# --- NEW: Added specific regex for Indian Railways tickets ---
# Define regular expressions for high-confidence PII
REGEX_PATTERNS = {
    # General PII
    "EMAIL": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "PHONE": re.compile(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"),
    "CREDIT_CARD": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
    "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    
    # Ticket-Specific PII
    "PNR": re.compile(r"\b\d{10}\b"),  # PNR is a 10-digit number
    "TRANSACTION_ID": re.compile(r"Transaction ID:\s*(\d+)"),
    "INVOICE_NUMBER": re.compile(r"Invoice Number:\s*([A-Z0-9]+)"),
}

# --- UPDATED: Added new PII types to the severity mapping ---
# Define which PII types correspond to each severity level
SEVERITY_MAPPING = {
    0: [],
    20: ["CREDIT_CARD", "SSN"],
    40: ["CREDIT_CARD", "SSN", "EMAIL", "PHONE", "PNR", "TRANSACTION_ID", "INVOICE_NUMBER"],
    60: ["CREDIT_CARD", "SSN", "EMAIL", "PHONE", "PNR", "TRANSACTION_ID", "INVOICE_NUMBER", "PERSON"],
    80: ["CREDIT_CARD", "SSN", "EMAIL", "PHONE", "PNR", "TRANSACTION_ID", "INVOICE_NUMBER", "PERSON", "GPE", "DATE"],
    100: ["CREDIT_CARD", "SSN", "EMAIL", "PHONE", "PNR", "TRANSACTION_ID", "INVOICE_NUMBER", "PERSON", "GPE", "DATE", "ORG"],
}

def find_pii(text: str, severity: int) -> List[Dict[str, int]]:
    """
    Finds PII in a given text based on the severity level.
    Returns a list of start and end character indices for each found PII.
    """
    pii_to_find = SEVERITY_MAPPING.get(severity, [])
    if not pii_to_find:
        return []

    found_pii = []

    # 1. Regex-based search for high-confidence patterns
    for pii_type, pattern in REGEX_PATTERNS.items():
        if pii_type in pii_to_find:
            for match in pattern.finditer(text):
                # For patterns with groups, find the group; otherwise, the whole match
                try:
                    start, end = match.span(1) # Try to get the captured group's position
                except IndexError:
                    start, end = match.span() # Fallback to the whole match
                
                found_pii.append({"start": start, "end": end, "label": pii_type})

    # 2. NER-based search using spaCy
    ner_types = [ptype for ptype in pii_to_find if ptype not in REGEX_PATTERNS]
    if ner_types:
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ in ner_types:
                found_pii.append({"start": ent.start_char, "end": ent.end_char, "label": ent.label_})

    return found_pii