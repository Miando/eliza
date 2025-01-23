import {
    Provider,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    embed,
    MemoryManager,
    formatMessages
} from "@ai16z/eliza";
import { db } from "../gamefiDB.ts";

const gameFiKnowledgesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const memoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiKnowledges",
        });
        const transactionsMemoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiTransactions",
        });
        // Установить всем записям processed = 0
        // db.prepare(`
        //     UPDATE gamefi_knowledge_base
        //     SET processed = 0
        // `).run();
        //
        // elizaLogger.info("All entries in gamefi_knowledge_base have been reset to processed = 0.");

        // memoryManager.removeAllMemories(message.roomId);
        // return "I'm going to fetch the latest news from GameFi.";
        // // Fetch unprocessed entries from the SQLite database
        // const unprocessedEntries = db.prepare(`
        //     SELECT * FROM gamefi_knowledge_base WHERE processed = 0
        // `).all();
        while (true) {
            // Берём первую необработанную запись
            const entry = db.prepare(`
                SELECT * FROM gamefi_knowledge_base WHERE processed = 0 AND type = 'transactions' LIMIT 1
            `).get();
            if (!entry) {
                elizaLogger.info("No more unprocessed entries.");
                break;
            }
            const entryEmbedding = await embed(runtime, entry.summary);
            elizaLogger.info(`Processing entry: ${entry.summary}`);
            const newMemory: Memory = {
                ...message, // Копируем все поля из оригинального сообщения
                content: { text: entry.summary}, // Заменяем текст на саммари
                embedding: entryEmbedding, // Добавляем эмбеддинг
                createdAt: Date.now(), // Устанавливаем новую временную метку
            };
            await transactionsMemoryManager.createMemory(newMemory);
            db.prepare(`
                UPDATE gamefi_knowledge_base
                SET processed = 1
                WHERE id = ?
            `).run(entry.id);
        }

        while (true) {
            // Берём первую необработанную запись
            const entry = db.prepare(`
                SELECT * FROM gamefi_knowledge_base WHERE processed = 0 AND type = 'news' LIMIT 1
            `).get();
            if (!entry) {
                elizaLogger.info("No more unprocessed entries.");
                break;
            }
            const entryEmbedding = await embed(runtime, entry.summary);
            elizaLogger.info(`Processing entry: ${entry.summary}`);
            const newMemory: Memory = {
                ...message, // Копируем все поля из оригинального сообщения
                content: { text: entry.summary}, // Заменяем текст на саммари
                embedding: entryEmbedding, // Добавляем эмбеддинг
                createdAt: Date.now(), // Устанавливаем новую временную метку
            };
            await memoryManager.createMemory(newMemory);
            db.prepare(`
                UPDATE gamefi_knowledge_base
                SET processed = 1
                WHERE id = ?
            `).run(entry.id);
        }
        const queryText = message.content.text;
        // const queryText = "What you can say about $SAND token?";
        // elizaLogger.info(queryText);

        const userEmbedding = await embed(runtime, queryText);

        const relevantFacts = await memoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            { count: 20, match_threshold: 0.9 }
        );
        const relevantTransactionFacts = await transactionsMemoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            { count: 1, match_threshold: 0.9 }
        );

        const formattedFacts = relevantFacts.map((fact, index) => {
            return `${index + 1}. ${fact.content.text || fact.content}`;
        }).join("\n");

        const formattedTransactionFacts = relevantTransactionFacts.map((fact, index) => {
            return `${index + 1}. ${fact.content.text || fact.content}`;
        }).join("\n");

        if (formattedFacts.length === 0 && formattedTransactionFacts.length === 0) {
            return "";
        }


        let result = "";

        if (formattedFacts.length > 0) {
            result += `Key facts that ${runtime.character.name} knows from news:\n${formattedFacts}`;
        }

        if (formattedTransactionFacts.length > 0) {
            if (result.length > 0) {
                result += "\n\n"; // Добавляем пустую строку между секциями
            }
            result += `Transaction-related facts that ${runtime.character.name} knows:\n${formattedTransactionFacts}`;
        }

        return result;
    },
};

export { gameFiKnowledgesProvider };
