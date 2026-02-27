FROM python:3.12-slim

WORKDIR /app

# Instala dependencias primero (mejor cache)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo el proyecto
COPY . /app

ENV PYTHONUNBUFFERED=1

# Railway te da el puerto en la variable PORT
# Elimina los corchetes y el ["sh", "-c"]
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT

