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

const gameFiKnowledgesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const recentMessagesData = state?.recentMessagesData?.slice(-10);
        const messagee = "Who is Donald Trump?"
        elizaLogger.info(message.content.text)
        const summary = `
        Massive wildfires have been raging in Los Angeles since January 7, 2025, with the hardest-hit areas being Pacific Palisades and Eaton Canyon.

        - Casualties and Damage: At least 25 people have died, over 10,000 structures have been destroyed, and around 153,000 residents have been evacuated.
        - Emergency Measures: A curfew has been imposed to prevent looting, and U.S. President Joe Biden has declared a major disaster in California.
        - Challenges: Strong winds and dry conditions are making it difficult for firefighters to control the flames.

        Efforts to combat the fires are ongoing.
        `;
        const summaryEmbedding = await embed(runtime, summary);
        // elizaLogger.info("summaryEmbedding", summaryEmbedding)
        const newMemory: Memory = {
            ...message, // Копируем все поля из оригинального сообщения
            content: { text: summary}, // Заменяем текст на саммари
            embedding: summaryEmbedding, // Добавляем эмбеддинг
            createdAt: Date.now(), // Устанавливаем новую временную метку
        };

        // const userEmbedding = await embed(runtime, message.content.text);
        const userEmbedding = await embed(runtime, messagee);
        const memoryManager = new MemoryManager({
            runtime,
            tableName: "GameFiKnowledges",
        });
        // memoryManager.removeAllMemories(message.roomId)
        // await memoryManager.createMemory(newMemory)

        const relevantFacts = await memoryManager.searchMemoriesByEmbeddingGeneral(
            userEmbedding,
            {count: 10, match_threshold: 0.8}
        );

        const formattedFacts = relevantFacts.map((fact, index) => {
            return `${index + 1}. ${fact.content.text || fact.content}`;
        }).join("\n");

        if (formattedFacts.length === 0) {
            return "";
        }

        return `Key facts that ${runtime.character.name} knows:\n${formattedFacts}`;

    },
};

export { gameFiKnowledgesProvider };
