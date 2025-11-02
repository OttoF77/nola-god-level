FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install (agora em requisitos-desafio/)
COPY requisitos-desafio/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

# Copy data generation script
COPY generate_data.py .

CMD ["python", "generate_data.py"]

