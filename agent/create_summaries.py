import sqlite3
from datetime import datetime, timedelta
from openai import OpenAI
import os

# Укажите пути к вашим базам данных
DB_PATH_SUMMARIES = 'data/gamefi_summaries.sqlite'
DB_PATH_MEMORIES = 'data/db.sqlite'
DB_PATH_TRANSACTIONS = 'data/crypto_transactions.sqlite3'
DB_PATH_NEWS = 'data/crypto.sqlite3'

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

def delete_old_gamefi_knowledges():
    """Удаляет записи из таблицы memories с type = 'GameFiKnowledges', старше 6 месяцев."""
    conn = sqlite3.connect(DB_PATH_MEMORIES)
    cursor = conn.cursor()

    six_months_ago = datetime.now() - timedelta(days=6*30)
    six_months_ago_str = six_months_ago.strftime('%Y-%m-%d %H:%M:%S')

    delete_query_knowledges = """
    DELETE FROM memories
    WHERE type = 'GameFiKnowledges' AND createdAt < ?;"""   #TODO We can not say date < six_months_ago_str

    cursor.execute(delete_query_knowledges, (six_months_ago_str,))
    print(f"Deleted records (GameFiKnowledges): {cursor.rowcount}")

    conn.commit()
    conn.close()

def process_transactions_and_update_summaries():
    """Processes transactions and updates summaries in the database."""
    conn_transactions = sqlite3.connect(DB_PATH_TRANSACTIONS)
    conn_summaries = sqlite3.connect(DB_PATH_SUMMARIES)
    conn_memories = sqlite3.connect(DB_PATH_MEMORIES)
    cursor_transactions = conn_transactions.cursor()
    cursor_summaries = conn_summaries.cursor()
    cursor_memories = conn_memories.cursor()

    # Check for unprocessed transactions
    select_unprocessed = """
    SELECT ticker, SUM(amount) as total_amount, COUNT(*) as transaction_count
    FROM transactions
    WHERE processed = 0
    GROUP BY ticker;
    """

    cursor_transactions.execute(select_unprocessed)
    unprocessed_data = cursor_transactions.fetchall()

    if not unprocessed_data:
        print("No unprocessed transactions.")
        conn_transactions.close()
        conn_summaries.close()
        conn_memories.close()
        return

    # Create detailed summaries via OpenAI API
    insert_summary_query = """
    INSERT INTO gamefi_knowledge_base (summary, type)
    VALUES (?, ?);
    """

    for ticker, total_amount, transaction_count in unprocessed_data:
        # Retrieve all records for the ticker over the last 6 months
        six_months_ago = datetime.now() - timedelta(days=6*30)
        six_months_ago_str = six_months_ago.strftime('%Y-%m-%d %H:%M:%S')

        query_transactions = """
        SELECT date, amount
        FROM transactions
        WHERE ticker = ? AND date >= ?
        ORDER BY amount DESC;
        """
        cursor_transactions.execute(query_transactions, (ticker, six_months_ago_str))
        recent_transactions = cursor_transactions.fetchall()

        # Create a prompt for OpenAI to generate a summary
        detailed_summary = generate_summary_transactions(ticker, total_amount, transaction_count, recent_transactions)

        cursor_summaries.execute(insert_summary_query, (detailed_summary, 'transactions'))

    # Mark transactions as processed
    mark_as_processed_query = """
    UPDATE transactions
    SET processed = 1
    WHERE processed = 0;
    """
    cursor_transactions.execute(mark_as_processed_query)

    conn_transactions.commit()
    conn_summaries.commit()

    print(f"Processed transactions: {len(unprocessed_data)}")

    conn_transactions.close()
    conn_summaries.close()
    conn_memories.close()

def process_news():
    """Processes news articles and saves summaries to the knowledge base."""
    conn = sqlite3.connect(DB_PATH_NEWS)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, release_date FROM news WHERE processed = 0")
    news = cursor.fetchall()

    if not news:
        print("No news to process.")
        conn.close()
        return

    conn_summaries = sqlite3.connect(DB_PATH_SUMMARIES)
    cursor_summaries = conn_summaries.cursor()

    insert_summary_query = """
    INSERT INTO gamefi_knowledge_base (summary, type)
    VALUES (?, ?);
    """

    for news_id, content, release_date in news:
        print(f"Processing news ID {news_id} with date {release_date}...")
        detailed_summary = generate_summary_news(content, release_date)

        if detailed_summary:
            cursor_summaries.execute(insert_summary_query, (detailed_summary, 'news'))
            cursor.execute("UPDATE news SET processed = 1 WHERE id = ?", (news_id,))
            print(f"News ID {news_id} processed and saved.")

    conn.commit()
    conn.close()
    conn_summaries.commit()
    conn_summaries.close()

def generate_summary_transactions(ticker, total_amount, transaction_count, recent_transactions):
    """Creates a detailed summary for transactions using the OpenAI API."""
    transactions_details = "\n".join(
        [f"Date: {date}, Amount: {amount}" for date, amount in recent_transactions]
    )
    prompt = (
        f"Create a detailed analytical summary for the ticker {ticker}.\n"
        f"Do not use #### and double '\\n\\n'.Transactions in the last 6 months:\n{transactions_details}"
    )

    try:
        response = client.chat.completions.create(  # Используем chat_completions
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an AI assistant that creates summaries of GameFi tokens Transactions. Summaries will be used for embedding into a knowledge base."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )

        summary = response.choices[0].message.content.strip()
        print(f"Generated summary: {summary}")

        # TODO add date to summary
        return summary

    except Exception as e:
        print(f"Error generating transaction summary: {e}")
        return None

def generate_summary_news(content, release_date):
    """Генерирует саммари новости с помощью ChatGPT."""
    prompt = f"Summarize the following news article and include the publication date ({release_date}). Need to add $ to all tokens or stock, for example $BTC. News article:\n\n{content}"
    try:
        response = client.chat.completions.create(  # Используем chat_completions
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI assistant that creates concise summaries of news articles. Summaries will be used for embedding into a knowledge base."},
                {"role": "user", "content": prompt}
            ],
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

# Main execution
if __name__ == "__main__":
    # delete_old_gamefi_knowledges()    #TODO we don't saved dates of publication
    process_transactions_and_update_summaries()
    process_news()
