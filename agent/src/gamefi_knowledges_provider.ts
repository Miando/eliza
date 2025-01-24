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


async function processUnprocessedEntries(
    db: any,
    type: string,
    memoryManager: MemoryManager,
    runtime: IAgentRuntime,
    message: Memory
) {
    while (true) {
        // Берём первую необработанную запись
        const entry = db.prepare(`
            SELECT * FROM gamefi_knowledge_base
            WHERE processed = 0 AND type = ?
            LIMIT 1
        `).get(type);

        if (!entry) {
            elizaLogger.info(`No more unprocessed entries for type: ${type}.`);
            break;
        }

        const entryEmbedding = await embed(runtime, entry.summary);
        elizaLogger.info(`Processing entry: ${entry.summary}`);

        const newMemory: Memory = {
            ...message, // Копируем все поля из оригинального сообщения
            content: { text: entry.summary }, // Заменяем текст на саммари
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
}

function formatFacts(facts: Memory[]) {
    return facts
        .map((fact, index) => `${index + 1}. ${fact.content.text || fact.content}`)
        .join("\n");
}

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

const gameFiKnowledgesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Создаем два менеджера памяти
        const memoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiKnowledges",
        });
        const transactionsMemoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiTransactions",
        });

        // Сначала обрабатываем type = 'transactions'
        await processUnprocessedEntries(db, 'transactions', transactionsMemoryManager, runtime, message);
        // Затем обрабатываем type = 'prices'
        await processUnprocessedEntries(db, 'prices', transactionsMemoryManager, runtime, message);
        // И наконец type = 'news'
        await processUnprocessedEntries(db, 'news', memoryManager, runtime, message);

        // Выполняем поиск по запросу
        const queryText = message.content.text;
        const userEmbedding = await embed(runtime, queryText);

        const relevantFacts = await memoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            { count: 20, match_threshold: 0.7 }
        );
        const relevantTransactionFacts = await transactionsMemoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            { count: 1, match_threshold: 0.7 }
        );
        const relevantPricesFacts = await transactionsMemoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            { count: 1, match_threshold: 0.7 }
        );

        const formattedFacts = formatFacts(relevantFacts);
        const formattedTransactionFacts = formatFacts(relevantTransactionFacts);
        const formattedPricesFacts = formatFacts(relevantPricesFacts);

        if (!formattedFacts && !formattedTransactionFacts && !formattedPricesFacts) {
            return "";
        }

        let result = "";

        if (formattedFacts) {
            result += `Key facts that ${runtime.character.name} knows from news:\n${formattedFacts}`;
        }

        if (formattedTransactionFacts) {
            if (result) result += "\n\n";
            result += `Transaction-related facts that ${runtime.character.name} knows:\n${formattedTransactionFacts}`;
        }

        if (formattedPricesFacts) {
            if (result) result += "\n\n";
            result += `Price-related facts that ${runtime.character.name} knows:\n${formattedPricesFacts}`;
        }

        return result;
    },
};

export { gameFiKnowledgesProvider };
