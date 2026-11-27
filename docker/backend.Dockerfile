FROM python:3.11-slim
WORKDIR /workspace/backend
ENV PYTHONDONTWRITEBYTECODE=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app app
COPY backend/migrations migrations
ENV WATCHFILES_FORCE_POLLING=true
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app", "--reload-dir", "migrations", "--reload-include", "*.sql"]
