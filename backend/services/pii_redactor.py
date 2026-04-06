import re

class PIIRedactor:
    """
    Utility to redact PII (Personally Identifiable Information) 
    before sending data to LLM providers.
    """
    @staticmethod
    def redact(text: str) -> str:
        if not text:
            return text
        
        # Redact Emails
        text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
        
        # Redact Phone Numbers (Basic format: +1234567890, (123) 456-7890, etc.)
        text = re.sub(r'(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', '[PHONE]', text)
        
        return text

    @staticmethod
    def redact_dict(data: dict) -> dict:
        """Recursively redact strings within a dictionary."""
        redacted = {}
        for k, v in data.items():
            if isinstance(v, str):
                redacted[k] = PIIRedactor.redact(v)
            elif isinstance(v, dict):
                redacted[k] = PIIRedactor.redact_dict(v)
            elif isinstance(v, list):
                redacted[k] = [PIIRedactor.redact_dict(i) if isinstance(i, dict) else (PIIRedactor.redact(i) if isinstance(i, str) else i) for i in v]
            else:
                redacted[k] = v
        return redacted
