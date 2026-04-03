#!/bin/bash

echo "============================================"
echo "  AI-Powered CRM - Setup Script"
echo "============================================"

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Setup PostgreSQL database
echo ""
echo "============================================"
echo "  Database Setup"
echo "============================================"
echo ""
echo "Make sure PostgreSQL is installed and running."
echo "Creating database and user..."

# Create database (modify credentials as needed)
sudo -u postgres psql << EOF
CREATE DATABASE ai_crm;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'crm_password';
GRANT ALL PRIVILEGES ON DATABASE ai_crm TO postgres;
EOF

echo "Database created successfully!"

# Run migrations
echo "Running database migrations..."
python -c "from database.models import Base; from database.connection import engine; Base.metadata.create_all(bind=engine)"

# Setup environment variables
echo ""
echo "Creating .env file..."
cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_crm

# LLM API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Redis
REDIS_URL=redis://localhost:6379/0

# Email
GMAIL_API_CREDENTIALS=path/to/credentials.json

# App Settings
DEBUG=True
SECRET_KEY=your_secret_key_here
EOF

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Start Redis: redis-server"
echo "3. Start API server: python main.py"
echo "4. Start Celery workers: celery -A workflows.worker worker"
echo ""
echo "API will be available at: http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo ""
