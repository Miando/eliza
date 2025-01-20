import sqlite3
from openai import OpenAI
from datetime import datetime
import os

# Чтение API-ключа из .env файла
def read_env_var(key, env_file="../.env"):
    """Читает значение переменной из .env файла."""
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.strip().split("=", 1)[1]
    return None

# Инициализация клиента OpenAI
api_key = read_env_var("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

def get_unprocessed_news(news_db_path):
    """Получает непросессед новости из базы данных вместе с датой публикации."""
    conn = sqlite3.connect(news_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, release_date FROM news WHERE processed = 0")
    rows = cursor.fetchall()
    conn.close()
    return rows

def update_news_processed(news_db_path, news_id):
    """Обновляет статус processed для новости."""
    conn = sqlite3.connect(news_db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE news SET processed = 1 WHERE id = ?", (news_id,))
    conn.commit()
    conn.close()

def save_summary(knowledge_base_db_path, summary):
    """Сохраняет саммари в базу знаний."""
    conn = sqlite3.connect(knowledge_base_db_path)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO gamefi_knowledge_base (summary) VALUES (?)", (summary,))
    conn.commit()
    conn.close()

def generate_summary(content, release_date):
    """Генерирует саммари новости с помощью ChatGPT."""
    prompt = f"Summarize the following news article and include the publication date ({release_date}). Need to add $ to all tokens or stock, for example $BTC. News article:\n\n{content}"
    try:
        response = client.chat.completions.create(  # Используем chat_completions
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI assistant that creates concise summaries of news articles. Summaries will be used for embedding into a knowledge base."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7
        )

        # Получаем текст ответа
        summary = response.choices[0].message.content.strip()
        print(f"Generated summary: {summary}")

        # TODO add date to summary
        return summary
    except Exception as e:
        print(f"Error generating summary: {e}")
        return None


def process_news(news_db_path, knowledge_base_db_path):
    """Основная функция обработки новостей."""
    news = get_unprocessed_news(news_db_path)
    if not news:
        print("No news to process.")
        return

    for news_id, content, release_date in news:
        print(f"Processing news ID {news_id} with date {release_date}...")
        summary = generate_summary(content, release_date)
        if summary:
            save_summary(knowledge_base_db_path, summary)
            update_news_processed(news_db_path, news_id)
            print(f"News ID {news_id} processed and saved.")
        else:
            print(f"Failed to process news ID {news_id}.")

if __name__ == "__main__":
    # Пути к базам данных
    news_db_path = "./data/crypto.sqlite3"
    knowledge_base_db_path = "./data/gamefi_summaries.sqlite"

    process_news(news_db_path, knowledge_base_db_path)
