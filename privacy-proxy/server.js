const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8081;
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'http://localhost:11434';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:*', // Only allow local requests
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

// Privacy sanitization functions
function sanitizePrompt(prompt) {
  // Remove potential PII patterns
  const piiPatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit cards
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
    /\b(?:username|password|token|key|secret)[\s]*[=:]\s*[\w\-\.@]+/gi, // Credentials
  ];

  let sanitized = prompt;
  piiPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

function hashRequest(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// LLM proxy endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    // Apply rate limiting
    await rateLimiter.consume(req.ip);

    // Validate request
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Sanitize messages
    const sanitizedMessages = req.body.messages.map(msg => ({
      ...msg,
      content: sanitizePrompt(msg.content)
    }));

    // Create request hash for logging (without exposing content)
    const requestHash = hashRequest(JSON.stringify(sanitizedMessages));
    console.log(`Processing request ${requestHash}`);

    // Forward to LLM service
    const llmResponse = await fetch(`${LLM_ENDPOINT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...req.body,
        messages: sanitizedMessages,
        temperature: Math.min(req.body.temperature || 0.1, 0.3), // Limit creativity for factual responses
      }),
    });

    if (!llmResponse.ok) {
      throw new Error(`LLM service error: ${llmResponse.status}`);
    }

    const result = await llmResponse.json();
    
    // Additional sanitization of response
    if (result.choices && result.choices[0] && result.choices[0].message) {
      result.choices[0].message.content = sanitizePrompt(result.choices[0].message.content);
    }

    console.log(`Completed request ${requestHash}`);
    res.json(result);

  } catch (rateLimiterRes) {
    if (rateLimiterRes instanceof Error) {
      console.error('LLM proxy error:', rateLimiterRes);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      console.log('Rate limit exceeded for', req.ip);
      res.status(429).json({ error: 'Rate limit exceeded' });
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Privacy proxy server running on port ${PORT}`);
  console.log(`Forwarding to LLM service at ${LLM_ENDPOINT}`);
});