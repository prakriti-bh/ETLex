export class PrivacyManager {
  private sensitivePatterns: RegExp[] = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
  ];

  async maskSensitiveData(data: any): Promise<any> {
    if (typeof data === 'string') {
      return this.maskText(data);
    }
    
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.maskSensitiveData(item)));
    }
    
    if (typeof data === 'object' && data !== null) {
      const maskedData: any = {};
      for (const [key, value] of Object.entries(data)) {
        maskedData[key] = await this.maskSensitiveData(value);
      }
      return maskedData;
    }
    
    return data;
  }

  async maskText(text: string): Promise<string> {
    let maskedText = text;
    
    // Apply all sensitive patterns
    this.sensitivePatterns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, '[REDACTED]');
    });
    
    // Remove potential table/column names that might contain PII
    maskedText = this.maskPotentialPII(maskedText);
    
    return maskedText;
  }

  private maskPotentialPII(text: string): string {
    // Generic patterns for common PII column names
    const piiColumns = [
      /\b(customer_id|user_id|account_id|email|phone|ssn|credit_card)\b/gi,
      /\b(first_name|last_name|full_name|address|zip_code|postal_code)\b/gi,
      /\b(date_of_birth|dob|birth_date|salary|income|wage)\b/gi
    ];
    
    let maskedText = text;
    piiColumns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, '[PII_COLUMN]');
    });
    
    return maskedText;
  }
}